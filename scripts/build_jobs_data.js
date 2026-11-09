const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildDailyEditorial } = require('./generate_editorial');

const radarRoot = path.join(__dirname, '..');
const outDir = path.join(radarRoot, 'data');
const outPath = path.join(outDir, 'jobs.json');

// Prioriza o vagas_do_dia.md dentro de radar-web/data/ (100% autônomo para repo próprio)
const localMdPath = path.join(outDir, 'vagas_do_dia.md');
const fallbackMdPath = path.join(process.cwd(), 'pessoal', 'curriculos', 'radar_vagas', 'vagas_do_dia.md');
const mdPath = fs.existsSync(localMdPath) ? localMdPath : fallbackMdPath;

if (!fs.existsSync(mdPath)) {
  console.error('Arquivo vagas_do_dia.md não encontrado em data/vagas_do_dia.md!');
  process.exit(1);
}

const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split('\n');

// Extrai o carimbo real da última varredura em vagas_do_dia.md (ou fallback para git/mtime)
let radarSweepIso = new Date().toISOString();
const sweepMatch = content.match(/\*\*Última atualização:\*\*\s*`(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*UTC`/i);
if (sweepMatch) {
  radarSweepIso = `${sweepMatch[1]}T${sweepMatch[2]}:00.000Z`;
} else {
  try {
    const gitIso = execSync('git log -1 --format=%cI', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (gitIso) {
      radarSweepIso = new Date(gitIso).toISOString();
    }
  } catch {
    const stat = fs.statSync(mdPath);
    radarSweepIso = stat.mtime.toISOString();
  }
}

const jobs = [];
let currentSection = 'Geral';

function parseGeo(loc, sec) {
  const l = (loc + ' ' + sec).toLowerCase();

  const isBrazil = l.includes('brazil') || l.includes('brasil') || l.includes('são paulo') || 
                   l.includes('rio de janeiro') || l.includes('florianópolis') || l.includes('uberlândia') || 
                   l.includes('barueri') || l.includes('montenegro') || l.includes('curitiba') ||
                   l.includes('belo horizonte') || l.includes('porto alegre') || l.includes('recife') || l.includes('brasília');

  const isSouthAmerica = isBrazil || l.includes('chile') || l.includes('santiago') || l.includes('argentina') || 
                         l.includes('buenos aires') || l.includes('uruguay') || l.includes('montevideo') || 
                         l.includes('colombia') || l.includes('paraguay') || l.includes('peru') || 
                         l.includes('américa do sul') || l.includes('latam') || l.includes('costa rica') || 
                         l.includes('mexico') || l.includes('latin america');

  const isNorthAmerica = l.includes('united states') || l.includes('usa') || l.includes('canada') || 
                         l.includes('austin') || l.includes('ohio') || l.includes('san francisco') || 
                         l.includes('new york') || l.includes('américa do norte') || l.includes('chicago') || 
                         l.includes('monroe') || l.includes('baltimore') || l.includes('arlington') ||
                         l.includes('seattle') || l.includes('colorado') || l.includes('california') || l.includes('toronto');

  const isEurope = l.includes('germany') || l.includes('berlin') || l.includes('munich') || 
                   l.includes('united kingdom') || l.includes('london') || l.includes('uk') || 
                   l.includes('ireland') || l.includes('dublin') || l.includes('portugal') || 
                   l.includes('lisboa') || l.includes('netherlands') || l.includes('poland') || 
                   l.includes('estonia') || l.includes('switzerland') || l.includes('france') || 
                   l.includes('spain') || l.includes('madrid') || l.includes('europa') ||
                   l.includes('european union') || l.includes('europe') || l.includes('ukraine') || l.includes('emea');

  const isAsia = l.includes('singapore') || l.includes('japan') || l.includes('south korea') || 
                 l.includes('australia') || l.includes('new zealand') || l.includes('ásia') || 
                 l.includes('israel') || l.includes('uae') || l.includes('dubai') ||
                 l.includes('philippines') || l.includes('india') || l.includes('apac');

  const isAfrica = l.includes('south africa') || l.includes('nigeria') || l.includes('kenya') || 
                   l.includes('egypt') || l.includes('africa');

  let flag = '🌐';
  if (isBrazil) flag = '🇧🇷';
  else if (l.includes('mexico')) flag = '🇲🇽';
  else if (l.includes('chile')) flag = '🇨🇱';
  else if (l.includes('argentina')) flag = '🇦🇷';
  else if (l.includes('uruguay')) flag = '🇺🇾';
  else if (l.includes('colombia')) flag = '🇨🇴';
  else if (isNorthAmerica) flag = '🇺🇸';
  else if (isEurope) flag = '🇪🇺';
  else if (isAsia) flag = '🇸🇬';
  else if (isAfrica) flag = '🌍';

  return {
    isBrazil,
    isSouthAmerica,
    isNorthAmerica,
    isEurope,
    isAsia,
    isAfrica,
    flag
  };
}

function inferArchetypeFromText(title = '', extra = '') {
  const t = `${title} ${extra}`.toLowerCase();
  if (/\b(ai|ml|machine learning|llm|agent|agentic|genai|ia|nlp|deep learning|data scientist)\b/i.test(t)) {
    return 'AI';
  }
  if (/\b(support|suporte|help desk|service desk|tier 1|tier 2|tier 3|n1|n2|n3|implantação|erp|sap|customer success|technical support|application support|qa|tester|quality assurance|sistemas)\b/i.test(t)) {
    return 'SUPPORT';
  }
  return 'DEV';
}

function normalizeModality(loc, rawEligibility, title) {
  const l = (loc || '').toLowerCase();
  const t = `${title} ${rawEligibility} ${loc}`.toLowerCase();
  const isEasy = t.includes('easy apply') || t.includes('simplificada');

  const isBr = l.includes('brazil') || l.includes('brasil') || l.includes('são paulo') || 
               l.includes('rio de janeiro') || l.includes('florianópolis') || l.includes('uberlândia') || 
               l.includes('barueri') || l.includes('montenegro') || l.includes('curitiba') || l.includes('belo horizonte');

  // Evita falso positivo em títulos como "Remote From Anywhere In Colorado"
  const anywhereInRestricted = /anywhere in (the )?(us|usa|united states|canada|uk|colorado|california|texas|new york|florida|europe|australia)/i.test(t);

  let base = '🌐 Remoto Internacional';
  if (isBr) {
    if (t.includes('latam') || t.includes('international') || t.includes('english') || t.includes('usd')) {
      base = '🌎 Remoto LATAM / Global (Brasil)';
    } else {
      base = '🇧🇷 Remoto Nacional (Brasil)';
    }
  } else if (anywhereInRestricted || t.includes('us only') || t.includes('w2')) {
    base = '🇺🇸 US Only (W2)';
  } else if (
    t.includes('contractor') ||
    t.includes('b2b') ||
    t.includes('latam') ||
    t.includes('worldwide') ||
    (t.includes('anywhere') && !t.includes('anywhere in'))
  ) {
    base = '🌎 Worldwide / Contractor B2B';
  }

  return isEasy ? `${base} • ⚡ Simplificada` : base;
}

function extractIsoDate(rawPosted) {
  if (!rawPosted) return '';
  const parenMatch = rawPosted.match(/\((\d{4}-\d{2}-\d{2})\)/);
  if (parenMatch) return parenMatch[1];
  const isoMatch = rawPosted.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const brMatch = rawPosted.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return '';
}

function normalizePostedDate(rawPosted) {
  const iso = extractIsoDate(rawPosted);
  if (iso) {
    const [yyyy, mm, dd] = iso.split('-');
    return `Publicada em ${dd}/${mm}/${yyyy}`;
  }
  return rawPosted || 'Últimas 24h';
}

function isTechRelevantForSite(title = '') {
  const t = title.toLowerCase();
  const nonTechBlock = /\b(account executive|account development|sales representative|sales development|business development|payer partnerships|email marketer|digital marketer|copywriter|freelance writer|content writer|land development|real estate|recruiter|talent acquisition|legal counsel|nurse|medical|accountant|bookkeeper|office assistant|inside sales|cold caller)\b/i;
  return !nonTechBlock.test(t);
}

function parseSource(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('linkedin.com')) return 'LINKEDIN';
  if (u.includes('himalayas.app')) return 'HIMALAYAS';
  if (u.includes('jobicy.com')) return 'JOBICY';
  if (u.includes('arbeitnow')) return 'ARBEITNOW';
  if (u.includes('remotive.com')) return 'REMOTIVE';
  return 'GLOBAL_BOARD';
}

function calculateUniversityIndexScore(jobTitle, jobLocation, modality, jobArchetype, isEasyApply, isStudent) {
  const text = `${jobTitle} ${jobLocation} ${modality} ${jobArchetype}`.toLowerCase();
  let score = 50;
  const tags = [];

  if (isStudent) {
    score += 28;
  } else if (/\b(senior|sênior|sr\.?|lead|staff|principal|head|director)\b/i.test(text)) {
    tags.push('NÍVEL: SÊNIOR');
  } else if (/\b(pleno|mid|ii|developer|analyst|analista|engineer|engenheiro)\b/i.test(text)) {
    score += 16;
    tags.push('NÍVEL: PLENO');
  }

  if (modality.includes('Remoto Nacional')) {
    score += 15;
    tags.push('VAGA NACIONAL (BR)');
  } else if (modality.includes('Worldwide') || modality.includes('LATAM')) {
    score += 15;
    tags.push('CONTRATO: GLOBAL B2B');
  }

  if (isEasyApply) {
    score += 8;
    tags.push('⚡ SIMPLIFICADA');
  }

  if (/\b(node|nodejs|node\.js)\b/i.test(text)) { score += 7; tags.push('STACK: NODE.JS'); }
  if (/\b(react|reactjs|next\.js|nextjs)\b/i.test(text)) { score += 7; tags.push('STACK: REACT'); }
  if (/\b(typescript|javascript)\b/i.test(text)) { score += 6; tags.push('STACK: TS/JS'); }
  if (/\b(python|django|fastapi)\b/i.test(text)) { score += 7; tags.push('STACK: PYTHON'); }
  if (/\b(sql|postgres|postgresql|banco de dados|data engineer|data analyst)\b/i.test(text)) { score += 6; tags.push('STACK: SQL & DADOS'); }
  if (/\b(ai|agent|agentic|llm|llms|ia|genai|machine learning|ml)\b/i.test(text)) { score += 8; tags.push('TRILHA: IA & LLMs'); }
  if (/\b(suporte|support|implantador|erp|service desk|help desk|sap|qa)\b/i.test(text)) { score += 7; tags.push('TRILHA: SUPORTE & ERP'); }

  if (score > 99) score = 99;
  if (score < 55) score = 55;

  return { score, tags: tags.slice(0, 4) };
}

for (const line of lines) {
  if (line.startsWith('## ')) {
    currentSection = line.replace('## ', '').trim();
  }
  if (!line.startsWith('| **')) continue;

  const linkMatch = line.match(/\[(?:Abrir|Link)\]\((https:\/\/[^)]+)\)/);
  if (!linkMatch) continue;
  const link = linkMatch[1].trim();

  const codeMatch = line.match(/^\|\s*\*\*([A-Z0-9_-]+)\*\*\s*\|/);
  const code = codeMatch ? codeMatch[1] : 'JOB';

  const innerText = line
    .replace(/^\|\s*\*\*[A-Z0-9_-]+\*\*\s*\|/, '')
    .replace(/\|\s*\[(?:Abrir|Link)\]\(https:\/\/[^)]+\)\s*\|?$/, '');
  const segments = innerText.split('|').map(s => s.trim()).filter(Boolean);

  let archetype = 'DEV';
  let rawEligibility = '🌐 Global Remote';
  let title = '';
  let company = '';
  let location = '';
  let rawPosted = 'Recente';

  const firstSegClean = (segments[0] || '').replace(/`/g, '').toUpperCase();
  const hasExplicitArchetype = ['AI', 'DEV', 'SUPPORT'].includes(firstSegClean);

  if (hasExplicitArchetype) {
    // Formato padrão (LinkedIn 6 segmentos internos ou Portais V3.5 7 segmentos internos com salário)
    archetype = firstSegClean;
    rawEligibility = segments[1] || '🌐 Global Remote';
    title = (segments[2] || '').replace(/\*\*/g, '');
    company = segments[3] || 'Confidential';
    location = segments[4] || 'Remote';
    // Se tiver 7 segmentos (com coluna Faixa Salarial/Tags), a data está no índice 6; se tiver 6, está no índice 5
    rawPosted = segments.length >= 7 ? segments[6] : (segments[5] || 'Recente');
  } else if (segments.length >= 6) {
    // Formato legado de Portais Abertos (sem coluna Área: Elegibilidade | Cargo | Empresa | Local | Salário | Data)
    rawEligibility = segments[0];
    title = (segments[1] || '').replace(/\*\*/g, '');
    company = segments[2] || 'Confidential';
    location = segments[3] || 'Remote';
    const salaryOrTags = segments[4] || '';
    rawPosted = segments[5] || 'Recente';
    archetype = inferArchetypeFromText(title, salaryOrTags);
  } else {
    continue;
  }

  if (title && link && isTechRelevantForSite(title)) {
    const geo = parseGeo(location, currentSection);
    const source = parseSource(link);
    const isEasyApply = rawEligibility.toLowerCase().includes('easy apply') || rawEligibility.includes('⚡');
    const lowerTitleLoc = (title + ' ' + location).toLowerCase();
    const isSeniorRole = /\b(senior|sênior|sr\.?|lead|staff|principal|head|director)\b/i.test(lowerTitleLoc);
    const isStudent = !isSeniorRole && /\b(junior|júnior|jr\.?|intern|internship|estágio|estagio|estagiário|entry level|entry-level|trainee|new grad|graduate|associate)\b/i.test(lowerTitleLoc);
    const modality = normalizeModality(location, rawEligibility, title);
    const postedIso = extractIsoDate(rawPosted);
    const posted = normalizePostedDate(rawPosted);
    const { score, tags } = calculateUniversityIndexScore(title, location, modality, archetype, isEasyApply, isStudent);

    jobs.push({
      id: code,
      title,
      company,
      location,
      source,
      isEasyApply,
      geo,
      archetype,
      eligibility: modality,
      posted,
      postedIso: postedIso || radarSweepIso.split('T')[0],
      url: link,
      score,
      matchReasons: tags,
      isStudentFriendly: isStudent
    });
  }
}

// Merge Protetor Zero-Loss: Preserva vagas recentes válidas do jobs.json anterior caso uma execução parcial seja rodada
if (fs.existsSync(outPath)) {
  try {
    const prevRaw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const prevJobs = Array.isArray(prevRaw) ? prevRaw : (prevRaw.jobs || []);
    const seenUrls = new Set(jobs.map(j => j.url.split('?')[0]));

    const currentNaCount = jobs.filter(j => j.geo && j.geo.isNorthAmerica).length;
    const currentAsiaCount = jobs.filter(j => j.geo && j.geo.isAsia).length;
    const currentEuCount = jobs.filter(j => j.geo && j.geo.isEurope).length;

    for (const pj of prevJobs) {
      if (!pj.url) continue;
      const cleanPrevUrl = pj.url.split('?')[0];
      if (seenUrls.has(cleanPrevUrl)) continue;

      // Nunca preserva registros legados corrompidos onde archetype não é AI/DEV/SUPPORT
      if (!['AI', 'DEV', 'SUPPORT'].includes(pj.archetype)) continue;

      const pGeo = pj.geo || parseGeo(pj.location || '', '');
      const shouldKeepRegionFallback =
        (currentNaCount < 10 && pGeo.isNorthAmerica) ||
        (currentAsiaCount < 5 && pGeo.isAsia) ||
        (currentEuCount < 10 && pGeo.isEurope);

      if (shouldKeepRegionFallback) {
        const source = pj.source || parseSource(pj.url);
        const isEasyApply = Boolean(pj.isEasyApply) || (pj.eligibility || '').includes('⚡');
        const pLower = (pj.title + ' ' + (pj.location || '')).toLowerCase();
        const isStudent = !pLower.includes('senior associate') && pLower.match(/(junior|júnior|intern|estágio|estagio|entry|trainee|new grad|associate)/) !== null;
        const modality = normalizeModality(pj.location, pj.eligibility || '', pj.title);
        const postedIso = pj.postedIso || extractIsoDate(pj.posted) || radarSweepIso.split('T')[0];
        const posted = normalizePostedDate(pj.posted);
        const { score, tags } = calculateUniversityIndexScore(pj.title, pj.location, modality, pj.archetype, isEasyApply, isStudent);

        jobs.push({
          ...pj,
          geo: pGeo,
          source,
          isEasyApply,
          isStudentFriendly: isStudent,
          eligibility: modality,
          posted,
          postedIso,
          score,
          matchReasons: tags
        });
        seenUrls.add(cleanPrevUrl);
      }
    }
  } catch (e) {
    console.warn('Aviso ao mesclar cache anterior:', e.message);
  }
}

jobs.sort((a, b) => b.score - a.score);

(async () => {
  const editorial = await buildDailyEditorial(jobs);
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    lastUpdated: radarSweepIso,
    nextEditionSchedule: '09:00 BRT (12:00 UTC)',
    totalJobs: jobs.length,
    editorial,
    jobs: jobs
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Sucesso! ${jobs.length} vagas íntegras e Editorial do Dia (${editorial.generatedBy}) salvos em: ${outPath}`);
})();
