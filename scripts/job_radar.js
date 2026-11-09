#!/usr/bin/env node
/**
 * Job Radar V3.5 — Motor Resiliente Zero-Loss (100% Autônomo em radar-web)
 * - Fila Sequencial Inteligente (Zero Multirequest Burst no LinkedIn)
 * - Cooldown Adaptativo Global + Rotação de User-Agent + Retry Exponencial (até 5 tentativas)
 * - Dead-Letter Queue (2ª Passagem Automática para recuperar qualquer query que tenha sofrido oscilação)
 * - Paginação Automática (captura página extra quando o lote de 25 vagas lota)
 * - Enriquecimento de Easy Apply (nunca perde a flag ⚡ Easy Apply se a vaga já existia na busca geral)
 * - Zero Cortes Artificiais (todas as vagas únicas aprovadas vão para o relatório e JSON)
 */

const fs = require('fs');
const path = require('path');

const REGIONS = {
  sa: {
    label: '🇧🇷🇲🇽🇨🇱🇨🇷🇺🇾🇦🇷🇵🇾 Colômbia | América Latina & Nearshore (Brasil, México, Costa Rica, Chile, Uruguai, Argentina, Paraguai, Colômbia)',
    locations: ['Brazil', 'Mexico', 'Costa Rica', 'Chile', 'Uruguay', 'Argentina', 'Paraguay', 'Colombia'],
    lang: 'both'
  },
  na: {
    label: '🇺🇸🇨🇦 América do Norte (EUA & Canadá)',
    locations: ['United States', 'Canada'],
    lang: 'en'
  },
  eu: {
    label: '🇪🇺🇬🇧 Europa (UK, Alemanha, Holanda, Suíça, Irlanda, Portugal, Polônia, Estônia, UE)',
    locations: ['European Union', 'United Kingdom', 'Germany', 'Netherlands', 'Switzerland', 'Portugal', 'Ireland', 'Poland', 'Estonia'],
    lang: 'en'
  },
  asia: {
    label: '🇸🇬🇯🇵🇰🇷🇦🇺🇳🇿 Ásia Desenvolvida & Pacífico (Singapura, Japão, Coreia do Sul, Austrália, Nova Zelândia)',
    locations: ['Singapore', 'Japan', 'South Korea', 'Australia', 'New Zealand'],
    lang: 'en'
  },
  me: {
    label: '🇦🇪🇮🇱 Oriente Médio Global (Emirados Árabes Unidos - Dubai, Israel)',
    locations: ['United Arab Emirates', 'Israel'],
    lang: 'en'
  }
};

const QUERIES_BY_ARCHETYPE = {
  ai: {
    en: [
      'AI Engineer Remote',
      'Python Developer LLM Agent Remote'
    ],
    pt: [
      'Engenheiro de IA Remoto',
      'Desenvolvedor Python IA Remoto'
    ]
  },
  dev: {
    en: [
      'Junior Full Stack Developer Node React Remote',
      'Software Engineer TypeScript Python Remote',
      'Backend Developer Node.js PostgreSQL Remote'
    ],
    pt: [
      'Desenvolvedor Full Stack Junior Remoto',
      'Desenvolvedor Node React Remoto',
      'Desenvolvedor Full Stack Remoto'
    ]
  },
  support: {
    en: [
      'Technical Support Engineer SQL Remote',
      'Application Support Analyst Tier 2 Remote'
    ],
    pt: [
      'Analista de Suporte N1 N2 Remoto',
      'Analista de Sistemas Junior Remoto'
    ]
  }
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
];

function getHeaders(attempt = 0) {
  const ua = USER_AGENTS[attempt % USER_AGENTS.length];
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
    'Cache-Control': 'no-cache'
  };
}

// Estatísticas de Telemetria de Rede
const stats = {
  totalRequests: 0,
  status200: 0,
  status429Retries: 0,
  networkRetries: 0,
  recoveredAfterRetry: 0,
  recoveredInSecondPass: 0,
  failedRequests: 0,
  paginatedExtras: 0,
  byDateCount: {}
};

// Controle de Cadência Global (Evita rajadas e ajusta intervalo dinamicamente se houver 429)
let lastRequestFinishTime = 0;
let baseIntervalMs = 850; // Intervalo base seguro entre o fim de uma requisição e o início da próxima

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitTurn() {
  const now = Date.now();
  const elapsed = now - lastRequestFinishTime;
  const jitter = Math.floor(Math.random() * 350);
  const targetWait = baseIntervalMs + jitter;
  if (elapsed < targetWait) {
    await sleep(targetWait - elapsed);
  }
}

function decodeHtml(html) {
  return (html || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeJobUrl(rawUrl) {
  if (!rawUrl) return '';
  const clean = rawUrl.split('?')[0].trim();
  const idMatch = clean.match(/(\d{8,12})$/);
  return idMatch ? `li-${idMatch[1]}` : clean.toLowerCase();
}

function inferArchetype(title = '', tagsOrCategory = '') {
  const t = `${title} ${tagsOrCategory}`.toLowerCase();
  if (/\b(ai|ml|machine learning|llm|agent|agentic|genai|ia|nlp|deep learning|data scientist)\b/i.test(t)) {
    return 'AI';
  }
  if (/\b(support|suporte|help desk|service desk|tier 1|tier 2|tier 3|n1|n2|n3|implantação|erp|sap|customer success|technical support|application support|qa|tester|quality assurance|sistemas)\b/i.test(t)) {
    return 'SUPPORT';
  }
  return 'DEV';
}

function isTechRelevantTitle(title = '') {
  const t = title.toLowerCase();
  // Bloqueia vagas claramente fora de escopo (vendas puras, marketing, redação, jurídico, imóveis, etc.)
  const nonTechBlock = /\b(account executive|account development|sales representative|sales development|business development|payer partnerships|email marketer|digital marketer|copywriter|freelance writer|content writer|land development|real estate|recruiter|talent acquisition|legal counsel|nurse|medical|accountant|bookkeeper|office assistant|inside sales|cold caller)\b/i;
  if (nonTechBlock.test(t)) return false;

  const techAllow = /\b(engineer|developer|desenvolvedor|engenheiro|programador|software|fullstack|full-stack|full stack|frontend|front-end|backend|back-end|python|node|react|typescript|javascript|java|golang|rust|c#|dotnet|sql|data|dados|ai|ia|ml|llm|devops|cloud|sre|qa|test|quality|support|suporte|analista|analyst|systems|sistemas|erp|sap|infra|network|redes|security|cyber|tech|it|ti|intern|estágio|estagiário|junior|júnior|trainee)\b/i;
  return techAllow.test(t);
}

function classifyEligibility(locationStr = '', textToScan = '') {
  const loc = (locationStr || '').toLowerCase();
  const combined = `${locationStr} ${textToScan}`.toLowerCase();

  if (
    loc.includes('brazil') ||
    loc.includes('brasil') ||
    loc.includes('são paulo') ||
    loc.includes('rio de janeiro') ||
    loc.includes('florianópolis') ||
    loc.includes('curitiba') ||
    loc.includes('belo horizonte') ||
    loc.includes('uberlândia') ||
    loc.includes('barueri') ||
    loc.includes('porto alegre') ||
    loc.includes('recife') ||
    loc.includes('brasília')
  ) {
    return '🇧🇷 Remoto Nacional (Brasil)';
  }

  // Detecta falso positivo "Remote from anywhere in [State/Country]"
  const anywhereInRestricted = /anywhere in (the )?(us|usa|united states|canada|uk|colorado|california|texas|new york|florida|europe|australia)/i.test(combined);

  if (
    !anywhereInRestricted &&
    (
      combined.includes('contractor') ||
      combined.includes('b2b') ||
      combined.includes('latam') ||
      combined.includes('south america') ||
      combined.includes('latin america') ||
      combined.includes('w8-ben') ||
      combined.includes('w-8') ||
      combined.includes('worldwide') ||
      (combined.includes('anywhere') && !combined.includes('anywhere in'))
    )
  ) {
    return '🌎 Worldwide / Contractor B2B';
  }

  if (
    anywhereInRestricted ||
    combined.includes('usa only') ||
    combined.includes('us only') ||
    combined.includes('must reside in the us') ||
    combined.includes('us citizen') ||
    combined.includes('w2 only')
  ) {
    return '🇺🇸 US Only (W2)';
  }

  return '🌐 Global Remote';
}

function parseLinkedInCards(html, location, keywords, easyApplyOnly, targetDate) {
  const jobs = [];
  const cardRegex = /<li>([\s\S]*?)<\/li>/g;
  let match;
  let rawCardsCount = 0;

  while ((match = cardRegex.exec(html)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
    const companyMatch = block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/);
    const locMatch = block.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);
    const timeMatch = block.match(/<time[^>]*datetime="([^"]*)"[^>]*>([\s\S]*?)<\/time>/);
    const linkMatch = block.match(/href="(https:\/\/[a-z]{2,3}\.linkedin\.com\/jobs\/view\/[^"?]+|https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/);

    if (titleMatch && linkMatch) {
      rawCardsCount++;
      const title = decodeHtml(titleMatch[1].replace(/<[^>]+>/g, ''));
      const company = companyMatch ? decodeHtml(companyMatch[1].replace(/<[^>]+>/g, '')) : 'Confidential';
      const loc = locMatch ? decodeHtml(locMatch[1].replace(/<[^>]+>/g, '')) : location;
      const postedText = timeMatch ? decodeHtml(timeMatch[2]) : 'Recent';
      const postedDate = timeMatch ? timeMatch[1].trim() : '';
      const link = linkMatch[1].trim();

      if (postedDate) {
        stats.byDateCount[postedDate] = (stats.byDateCount[postedDate] || 0) + 1;
      }

      if (targetDate && postedDate !== targetDate) {
        continue;
      }

      let eligibility = classifyEligibility(loc, `${title} ${keywords}`);
      if (easyApplyOnly && !eligibility.includes('⚡')) {
        eligibility = `${eligibility} ⚡ Easy Apply`;
      }

      jobs.push({
        title,
        company,
        location: loc,
        eligibility,
        isEasyApply: easyApplyOnly,
        posted: postedDate ? `${postedText} (${postedDate})` : postedText,
        postedDate,
        url: link,
        query: keywords
      });
    }
  }
  return { jobs, rawCardsCount };
}

/**
 * Busca uma página da API Guest do LinkedIn com até 5 tentativas e Cooldown Exponencial.
 * Retorna { ok: boolean, jobs: Array, rawCardsCount: number }
 */
async function fetchLinkedInPage(keywords, location, hours = 24, easyApplyOnly = false, targetDate = null, startOffset = 0, maxRetries = 4) {
  const tprSeconds = hours * 3600;
  const paramsObj = {
    keywords,
    location,
    f_WT: '2', // 100% Remote
    f_TPR: `r${tprSeconds}`,
    sortBy: 'DD',
    start: String(startOffset)
  };
  if (easyApplyOnly) {
    paramsObj.f_AL = 'true';
  }
  const params = new URLSearchParams(paramsObj);
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await waitTurn();
      stats.totalRequests++;

      const res = await fetch(url, {
        headers: getHeaders(attempt),
        signal: AbortSignal.timeout(15000)
      });
      lastRequestFinishTime = Date.now();

      if (res.status === 429 || res.status === 999 || res.status >= 500) {
        stats.status429Retries++;
        // Aumenta cautelosamente o intervalo base para proteger o restante da fila
        baseIntervalMs = Math.min(1600, baseIntervalMs + 150);

        if (attempt < maxRetries) {
          // Backoff progressivo forte: 3.5s -> 7s -> 12s -> 18s
          const backoffMs = Math.pow(attempt + 1, 1.6) * 3200 + Math.floor(Math.random() * 1000);
          await sleep(backoffMs);
          continue;
        } else {
          return { ok: false, jobs: [], rawCardsCount: 0 };
        }
      }

      if (!res.ok) {
        if (attempt < maxRetries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return { ok: false, jobs: [], rawCardsCount: 0 };
      }

      stats.status200++;
      if (attempt > 0) stats.recoveredAfterRetry++;
      // Se respondeu 200 de primeira, relaxa gradualmente o intervalo até o piso seguro de 800ms
      if (attempt === 0 && baseIntervalMs > 800) {
        baseIntervalMs = Math.max(800, baseIntervalMs - 25);
      }

      const html = await res.text();
      const { jobs, rawCardsCount } = parseLinkedInCards(html, location, keywords, easyApplyOnly, targetDate);
      return { ok: true, jobs, rawCardsCount };
    } catch {
      lastRequestFinishTime = Date.now();
      stats.networkRetries++;
      if (attempt < maxRetries) {
        await sleep(2500 * (attempt + 1));
      } else {
        return { ok: false, jobs: [], rawCardsCount: 0 };
      }
    }
  }
  return { ok: false, jobs: [], rawCardsCount: 0 };
}

/**
 * Busca completa de uma query no LinkedIn (com suporte a paginação se a página 1 vier cheia)
 */
async function fetchLinkedInGuestComplete(keywords, location, hours = 24, easyApplyOnly = false, targetDate = null) {
  const page1 = await fetchLinkedInPage(keywords, location, hours, easyApplyOnly, targetDate, 0, 4);
  if (!page1.ok) {
    return { ok: false, jobs: [] };
  }

  const allJobs = [...page1.jobs];

  // Se a 1ª página retornou 24 ou 25 cards nos hubs principais, busca a 2ª página (start=25) para não deixar vagas para trás
  const isMajorHub = ['Brazil', 'United States', 'European Union', 'United Kingdom', 'Canada', 'Germany', 'Portugal'].includes(location);
  if (isMajorHub && page1.rawCardsCount >= 24 && !easyApplyOnly) {
    const page2 = await fetchLinkedInPage(keywords, location, hours, easyApplyOnly, targetDate, 25, 3);
    if (page2.ok && page2.jobs.length > 0) {
      stats.paginatedExtras += page2.jobs.length;
      allJobs.push(...page2.jobs);
    }
  }

  return { ok: true, jobs: allJobs };
}

/**
 * Helper seguro com Retry + Timeout para os 4 Portais Globais Abertos
 */
async function fetchJsonWithRetry(url, portalName, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: getHeaders(attempt),
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        return await res.json();
      }
      if (attempt < maxRetries) {
        await sleep(2000 * (attempt + 1));
      }
    } catch (e) {
      if (attempt < maxRetries) {
        await sleep(2000 * (attempt + 1));
      } else {
        console.warn(`  ⚠️ [${portalName}] Falha após ${maxRetries + 1} tentativas: ${e.message}`);
      }
    }
  }
  return null;
}

async function fetchRemotiveGlobal(targetDate = null) {
  const data = await fetchJsonWithRetry('https://remotive.com/api/remote-jobs?category=software-dev&limit=50', 'Remotive');
  if (!data || !Array.isArray(data.jobs)) return [];

  return data.jobs
    .filter(j => isTechRelevantTitle(j.title))
    .map(j => {
      const pDate = (j.publication_date || '').split('T')[0];
      if (pDate) stats.byDateCount[pDate] = (stats.byDateCount[pDate] || 0) + 1;
      const arch = inferArchetype(j.title, j.category || '');
      return {
        source: 'Remotive',
        archetype: arch,
        title: decodeHtml(j.title),
        company: decodeHtml(j.company_name),
        location: decodeHtml(j.candidate_required_location || 'Worldwide'),
        eligibility: classifyEligibility(j.candidate_required_location, j.title),
        salary: j.salary || 'Market Rate',
        posted: pDate || 'Recent',
        postedDate: pDate,
        url: j.url
      };
    })
    .filter(j => !targetDate || j.postedDate === targetDate);
}

async function fetchArbeitnowEurope(targetDate = null) {
  const data = await fetchJsonWithRetry('https://www.arbeitnow.com/api/job-board-api', 'Arbeitnow');
  if (!data || !Array.isArray(data.data)) return [];

  return data.data
    .filter(j => j.remote === true && isTechRelevantTitle(j.title))
    .map(j => {
      const pDate = new Date(j.created_at * 1000).toISOString().split('T')[0];
      if (pDate) stats.byDateCount[pDate] = (stats.byDateCount[pDate] || 0) + 1;
      const tagsStr = (j.tags || []).join(', ');
      const arch = inferArchetype(j.title, tagsStr);
      return {
        source: 'Arbeitnow (EU)',
        archetype: arch,
        title: decodeHtml(j.title),
        company: decodeHtml(j.company_name),
        location: `${decodeHtml(j.location || 'Europe')} (Remote)`,
        eligibility: classifyEligibility(j.location, j.title),
        salary: (j.tags || []).slice(0, 3).join(', ') || 'Tech',
        posted: pDate,
        postedDate: pDate,
        url: j.url
      };
    })
    .filter(j => !targetDate || j.postedDate === targetDate);
}

async function fetchJobicyGlobal(targetDate = null) {
  const data = await fetchJsonWithRetry('https://jobicy.com/api/v2/remote-jobs?count=40&tag=dev', 'Jobicy');
  if (!data || !Array.isArray(data.jobs)) return [];

  return data.jobs
    .filter(j => isTechRelevantTitle(j.jobTitle))
    .map(j => {
      const rawPub = j.pubDate || '';
      const pDate = rawPub.includes('T') ? rawPub.split('T')[0] : (rawPub.split(' ')[0] || 'Recent');
      if (pDate && pDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        stats.byDateCount[pDate] = (stats.byDateCount[pDate] || 0) + 1;
      }
      const arch = inferArchetype(j.jobTitle, Array.isArray(j.jobIndustry) ? j.jobIndustry.join(' ') : '');
      return {
        source: 'Jobicy',
        archetype: arch,
        title: decodeHtml(j.jobTitle),
        company: decodeHtml(j.companyName),
        location: decodeHtml(j.jobGeo || 'Anywhere'),
        eligibility: classifyEligibility(j.jobGeo, `${j.jobTitle} ${j.jobExcerpt || ''}`),
        salary: j.annualSalaryMin && j.annualSalaryMax ? `$${j.annualSalaryMin}-$${j.annualSalaryMax}` : 'Market Rate',
        posted: pDate,
        postedDate: pDate,
        url: j.url
      };
    })
    .filter(j => !targetDate || j.postedDate === targetDate);
}

async function fetchHimalayasGlobal(targetDate = null) {
  const data = await fetchJsonWithRetry('https://himalayas.app/jobs/api?limit=50', 'Himalayas');
  if (!data || !Array.isArray(data.jobs)) return [];

  return data.jobs
    .filter(j => isTechRelevantTitle(j.title))
    .map(j => {
      const restrictions = Array.isArray(j.locationRestrictions) ? j.locationRestrictions.join(', ') : (j.locationRestrictions || 'Worldwide');
      const pubDate = String(j.pubDate || j.publishedAt || '');
      let pDate = 'Recent';
      if (/^\d{10,13}$/.test(pubDate)) {
        const ts = pubDate.length === 10 ? Number(pubDate) * 1000 : Number(pubDate);
        pDate = new Date(ts).toISOString().split('T')[0];
      } else if (pubDate.includes('T')) {
        pDate = pubDate.split('T')[0];
      } else if (pubDate.split(' ')[0]) {
        pDate = pubDate.split(' ')[0];
      }
      if (pDate && pDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        stats.byDateCount[pDate] = (stats.byDateCount[pDate] || 0) + 1;
      }
      const salaryText = (j.minSalary && j.maxSalary)
        ? `$${Math.round(j.minSalary / 1000)}k-$${Math.round(j.maxSalary / 1000)}k`
        : 'Market Rate';
      const jobUrl = j.applicationUrl || (j.slug ? `https://himalayas.app/jobs/${j.slug}` : j.guid || 'https://himalayas.app');
      const arch = inferArchetype(j.title, Array.isArray(j.categories) ? j.categories.join(' ') : '');

      return {
        source: 'Himalayas',
        archetype: arch,
        title: decodeHtml(j.title),
        company: decodeHtml(j.companyName),
        location: decodeHtml(restrictions || 'Worldwide'),
        eligibility: classifyEligibility(restrictions, j.title),
        salary: salaryText,
        posted: pDate,
        postedDate: pDate,
        url: jobUrl
      };
    })
    .filter(j => !targetDate || j.postedDate === targetDate);
}

/**
 * Insere ou enriquece vaga sem perder flags (ex: se a vaga já existia e agora veio no lote Easy Apply, atualiza para ⚡ Easy Apply)
 */
function upsertJobIntoBucket(bucketArray, seenMap, job) {
  const urlKey = normalizeJobUrl(job.url);
  const textKey = `${job.title.toLowerCase()}|${job.company.toLowerCase()}|${(job.location || '').toLowerCase()}`;

  const existing = seenMap.get(urlKey) || seenMap.get(textKey);
  if (existing) {
    if (job.isEasyApply && !existing.isEasyApply) {
      existing.isEasyApply = true;
      if (!existing.eligibility.includes('⚡')) {
        existing.eligibility = `${existing.eligibility} ⚡ Easy Apply`;
      }
    }
    return false;
  }

  seenMap.set(urlKey, job);
  seenMap.set(textKey, job);
  bucketArray.push(job);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  const targetDate = dateArg ? dateArg.split('=')[1].trim() : null;
  const cleanArgs = args.filter(a => !a.startsWith('--'));

  const argRegion = (cleanArgs[0] || 'all').toLowerCase();
  const argArchetype = (cleanArgs[1] || 'all').toLowerCase();
  const defaultHours = targetDate ? '168' : '24';
  const argHours = parseInt(cleanArgs[2] || defaultHours, 10);

  const targetRegions = argRegion === 'all'
    ? Object.keys(REGIONS)
    : (REGIONS[argRegion] ? [argRegion] : Object.keys(REGIONS));

  const targetArchetypes = argArchetype === 'all'
    ? Object.keys(QUERIES_BY_ARCHETYPE)
    : (QUERIES_BY_ARCHETYPE[argArchetype] ? [argArchetype] : Object.keys(QUERIES_BY_ARCHETYPE));

  console.log(`🌍 Iniciando Job Radar V3.5 Zero-Loss (Fila Sequencial Anti-Bloqueio + Dead-Letter Retry)...`);
  console.log(`   Regiões: ${targetRegions.join(', ').toUpperCase()} | Arquétipos: ${targetArchetypes.join(', ').toUpperCase()} | Janela: ${argHours}h${targetDate ? ` | Filtro Data: ${targetDate}` : ''}`);

  const regionBuckets = {};
  const globalSeenMap = new Map();
  const deadLetterQueue = [];

  for (const rKey of targetRegions) {
    regionBuckets[rKey] = [];
    const regionCfg = REGIONS[rKey];
    const querySpecs = [];

    for (const arch of targetArchetypes) {
      for (const loc of regionCfg.locations) {
        const qList = [...QUERIES_BY_ARCHETYPE[arch].en];
        if (regionCfg.lang === 'both' && loc === 'Brazil') {
          qList.push(...QUERIES_BY_ARCHETYPE[arch].pt);
        }
        for (const q of qList) {
          querySpecs.push({ rKey, arch: arch.toUpperCase(), loc, q, easyApply: false });
          if (loc === 'Brazil' || loc === 'United States' || loc === 'European Union') {
            querySpecs.push({ rKey, arch: arch.toUpperCase(), loc, q, easyApply: true });
          }
        }
      }
    }

    // Execução Estritamente Sequencial por Região (Risco ZERO de estourar multirequest no LinkedIn)
    for (let i = 0; i < querySpecs.length; i++) {
      const spec = querySpecs[i];
      const result = await fetchLinkedInGuestComplete(spec.q, spec.loc, argHours, spec.easyApply, targetDate);

      if (!result.ok) {
        deadLetterQueue.push(spec);
      } else {
        for (const item of result.jobs) {
          const enriched = { ...item, archetype: spec.arch, searchedCountry: spec.loc };
          upsertJobIntoBucket(regionBuckets[rKey], globalSeenMap, enriched);
        }
      }

      if ((i + 1) % 10 === 0 || i + 1 === querySpecs.length) {
        process.stdout.write(`\r   ⏳ [${rKey.toUpperCase()}] Progresso: ${i + 1}/${querySpecs.length} queries | Capturadas na região: ${regionBuckets[rKey].length} vagas...`);
      }
    }
    process.stdout.write('\n');
    console.log(`  ✔️ ${regionCfg.label}: ${regionBuckets[rKey].length} vagas únicas.`);
  }

  // 2ª PASSAGEM AUTOMÁTICA (Dead-Letter Queue): Se alguma query sofreu oscilação ou 429 persistente, aguarda resfriamento e reexecuta
  if (deadLetterQueue.length > 0) {
    console.log(`\n🔄 [SEGUNDA PASSAGEM] Recuperando ${deadLetterQueue.length} queries pendentes após resfriamento de 8s...`);
    await sleep(8000);
    baseIntervalMs = 1300;

    for (const spec of deadLetterQueue) {
      const retryRes = await fetchLinkedInGuestComplete(spec.q, spec.loc, argHours, spec.easyApply, targetDate);
      if (retryRes.ok) {
        stats.recoveredInSecondPass++;
        for (const item of retryRes.jobs) {
          const enriched = { ...item, archetype: spec.arch, searchedCountry: spec.loc };
          upsertJobIntoBucket(regionBuckets[spec.rKey], globalSeenMap, enriched);
        }
      } else {
        stats.failedRequests++;
      }
    }
  }

  console.log(`  📡 Consultando portais globais abertos (Remotive, Arbeitnow, Jobicy, Himalayas)...`);
  const [remotiveRaw, arbeitnowRaw, jobicyRaw, himalayasRaw] = await Promise.all([
    fetchRemotiveGlobal(targetDate),
    fetchArbeitnowEurope(targetDate),
    fetchJobicyGlobal(targetDate),
    fetchHimalayasGlobal(targetDate)
  ]);

  // Deduplica também os portais abertos contra o mapa global para não repetir links idênticos
  const dedupPortal = (list) => {
    const out = [];
    for (const job of list) {
      upsertJobIntoBucket(out, globalSeenMap, job);
    }
    return out;
  };

  const himalayasJobs = dedupPortal(himalayasRaw);
  const jobicyJobs = dedupPortal(jobicyRaw);
  const arbeitnowJobs = dedupPortal(arbeitnowRaw);
  const remotiveJobs = dedupPortal(remotiveRaw);

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

  // Localiza com precisão a pasta radar-web/data independente de onde o script foi chamado
  const candidateRadarDirs = [
    path.join(__dirname, '..', 'data'),
    path.join(process.cwd(), 'pessoal', 'projetos pessoais', 'radar-web', 'data'),
    path.join(process.cwd(), 'pessoal', 'radar-web', 'data')
  ];
  const radarDataDir = candidateRadarDirs.find(d => fs.existsSync(path.dirname(d))) || candidateRadarDirs[0];
  fs.mkdirSync(radarDataDir, { recursive: true });
  const standaloneOutPath = path.join(radarDataDir, 'vagas_do_dia.md');

  const totalLinkedIn = Object.values(regionBuckets).reduce((acc, arr) => acc + arr.length, 0);
  const totalOpenPortals = remotiveJobs.length + arbeitnowJobs.length + jobicyJobs.length + himalayasJobs.length;

  let md = `# 🌍 Global Job Radar V3 — Worldwide & Contractor Friendly Edition\n\n`;
  md += `**Última atualização:** \`${nowStr} UTC\` | **Janela:** Últimas ${argHours}h | **Modalidade:** \`100% Remote\` | **Risco de Ban:** \`0% (Guest API)\`\n\n`;
  md += `**Resumo da Varredura:** **${totalLinkedIn}** vagas no LinkedIn Global + **${totalOpenPortals}** vagas em Portais Globais Abertos.\n\n`;
  md += `---\n\n`;

  // Sem cortes artificiais (Zero Slice): todas as vagas únicas capturadas são salvas
  for (const rKey of targetRegions) {
    const regionCfg = REGIONS[rKey];
    const jobs = regionBuckets[rKey];
    md += `## ${regionCfg.label} (${jobs.length} vagas nas últimas ${argHours}h)\n\n`;
    if (jobs.length === 0) {
      md += `*Nenhuma vaga retornada nesta janela.*\n\n`;
    } else {
      const byArch = { AI: [], DEV: [], SUPPORT: [] };
      jobs.forEach(j => {
        if (byArch[j.archetype]) byArch[j.archetype].push(j);
        else byArch.DEV.push(j);
      });
      const allOrdered = [
        ...byArch.AI,
        ...byArch.DEV,
        ...byArch.SUPPORT
      ];

      md += `| Código | Área | Elegibilidade | Cargo / Role | Empresa | País / Local | Publicada | Link |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      allOrdered.forEach((j, idx) => {
        const code = `${rKey.toUpperCase()}-${idx + 1}`;
        const safeTitle = (j.title || '').replace(/\|/g, ' - ');
        const safeCompany = (j.company || '').replace(/\|/g, ' - ');
        const safeLoc = (j.location || '').replace(/\|/g, ', ');
        md += `| **${code}** | \`${j.archetype}\` | ${j.eligibility} | **${safeTitle}** | ${safeCompany} | ${safeLoc} | ${j.posted} | [Abrir](${j.url}) |\n`;
      });
      md += `\n`;
    }
  }

  const writePortalSection = (heading, prefix, list) => {
    if (list.length === 0) return;
    md += `---\n\n`;
    md += `## ${heading} (${list.length} vagas)\n\n`;
    md += `| Código | Área | Elegibilidade | Cargo / Role | Empresa | Local / Restrição | Faixa Salarial / Tags | Data | Link |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    list.forEach((j, idx) => {
      const safeTitle = (j.title || '').replace(/\|/g, ' - ');
      const safeCompany = (j.company || '').replace(/\|/g, ' - ');
      const safeLoc = (j.location || '').replace(/\|/g, ', ');
      const safeSal = (j.salary || 'Market Rate').replace(/\|/g, ' ');
      md += `| **${prefix}-${idx + 1}** | \`${j.archetype || 'DEV'}\` | ${j.eligibility} | **${safeTitle}** | ${safeCompany} | ${safeLoc} | ${safeSal} | ${j.posted} | [Abrir](${j.url}) |\n`;
    });
    md += `\n`;
  };

  writePortalSection('🏔️ Himalayas Remote Board', 'HIM', himalayasJobs);
  writePortalSection('⚡ Jobicy Global Tech Board', 'JBC', jobicyJobs);
  writePortalSection('🇪🇺 Arbeitnow Europe Tech Board', 'EU-B', arbeitnowJobs);
  writePortalSection('🌐 Remotive Global Remote Board', 'GL', remotiveJobs);

  fs.writeFileSync(standaloneOutPath, md, 'utf8');

  // Espelha também em pessoal/curriculos/radar_vagas/vagas_do_dia.md (suporta execução de qualquer pasta do monorepo)
  const legacyCandidates = [
    path.join(process.cwd(), 'pessoal', 'curriculos', 'radar_vagas'),
    path.join(__dirname, '..', '..', '..', 'curriculos', 'radar_vagas'),
    path.join(__dirname, '..', '..', 'curriculos', 'radar_vagas')
  ];
  for (const legDir of legacyCandidates) {
    if (fs.existsSync(path.dirname(legDir))) {
      try {
        fs.mkdirSync(legDir, { recursive: true });
        fs.writeFileSync(path.join(legDir, 'vagas_do_dia.md'), md, 'utf8');
        break;
      } catch {}
    }
  }

  console.log(`\n📊 TELEMETRIA DE REDE (ZERO-LOSS ENGINE):`);
  console.log(`   • Total de Requisições LinkedIn: ${stats.totalRequests}`);
  console.log(`   • Respostas 200 OK:              ${stats.status200}`);
  console.log(`   • Rate Limits (429) Tratados:    ${stats.status429Retries} (Recuperadas no retry: ${stats.recoveredAfterRetry})`);
  console.log(`   • Recuperadas na 2ª Passagem:    ${stats.recoveredInSecondPass}`);
  console.log(`   • Vagas Extras por Paginação:    ${stats.paginatedExtras}`);
  console.log(`   • Falhas Finais (Perda Zero=0):  ${stats.failedRequests}`);

  const sortedDates = Object.entries(stats.byDateCount).sort((a, b) => b[0].localeCompare(a[0]));
  if (sortedDates.length > 0) {
    console.log(`\n📅 DISTRIBUIÇÃO DE VAGAS POR DATA DE PUBLICAÇÃO:`);
    sortedDates.slice(0, 10).forEach(([dt, cnt]) => {
      console.log(`   • ${dt}: ${cnt} vagas capturadas`);
    });
  }

  console.log(`\n✅ Relatório salvo em: ${standaloneOutPath}`);
}

main();
