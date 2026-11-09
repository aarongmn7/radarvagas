const fs = require('fs');
const path = require('path');

// Carrega .env sem dependências externas (Zero-Dependency)
function loadEnv() {
  if (process.env.GEMINI_API_KEY) return;
  const candidatePaths = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '..', '.env')
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const k = match[1].trim();
            const v = match[2].trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        }
        break;
      } catch (e) {
        // silent
      }
    }
  }
}

/**
 * Gerador Editorial do Jornal de Vagas Tech — 1 Requisição Diária (Gemini Flash Free Tier + Fallback Determinístico)
 * Se a variável de ambiente GEMINI_API_KEY existir, faz 1 chamada gratuita na API do Google AI Studio.
 * Caso contrário, gera a síntese editorial de forma 100% determinística a partir dos dados reais da edição.
 */

async function buildDailyEditorial(jobs) {
  loadEnv();
  const total = jobs.length;
  const brJobs = jobs.filter(j => j.geo && j.geo.isBrazil);
  const jrJobs = jobs.filter(j => j.isStudentFriendly);
  const globalB2bJobs = jobs.filter(j => (j.eligibility || '').includes('Worldwide') || (j.eligibility || '').includes('LATAM'));
  const aiJobs = jobs.filter(j => j.archetype === 'AI');

  // Seleciona as 3 Vagas de Ouro da Edição (Sem repetição)
  const usedIds = new Set();
  const pickTop = (list) => {
    const candidate = list.find(j => !usedIds.has(j.id)) || jobs.find(j => !usedIds.has(j.id));
    if (candidate) usedIds.add(candidate.id);
    return candidate || null;
  };

  // 1. Vaga Ouro Estágio / Júnior (Prioriza Brasil)
  const spotJunior = pickTop(jrJobs.filter(j => j.geo && j.geo.isBrazil).concat(jrJobs));
  // 2. Vaga Ouro Internacional / B2B
  const spotGlobal = pickTop(globalB2bJobs.filter(j => !j.geo?.isBrazil).concat(globalB2bJobs));
  // 3. Vaga Ouro IA / Full Stack
  const spotAiTech = pickTop(aiJobs.concat(jobs));

  const topPicks = [
    spotJunior ? { badge: 'DESTAQUE ESTÁGIO & JÚNIOR', job: spotJunior } : null,
    spotGlobal ? { badge: 'DESTAQUE GLOBAL / B2B', job: spotGlobal } : null,
    spotAiTech ? { badge: 'DESTAQUE ENGENHARIA & IA', job: spotAiTech } : null
  ].filter(Boolean);

  // Contagem de stacks em alta para o resumo
  const stackCounts = {
    'Python': jobs.filter(j => JSON.stringify(j.matchReasons).includes('PYTHON')).length,
    'React': jobs.filter(j => JSON.stringify(j.matchReasons).includes('REACT')).length,
    'Node.js': jobs.filter(j => JSON.stringify(j.matchReasons).includes('NODE')).length,
    'SQL & Dados': jobs.filter(j => JSON.stringify(j.matchReasons).includes('SQL')).length,
    'Suporte & ERP': jobs.filter(j => j.archetype === 'SUPPORT').length
  };
  const sortedStacks = Object.entries(stackCounts).sort((a, b) => b[1] - a[1]);
  const topStack1 = sortedStacks[0] ? `${sortedStacks[0][0]} (${sortedStacks[0][1]})` : 'Full Stack';
  const topStack2 = sortedStacks[1] ? `${sortedStacks[1][0]} (${sortedStacks[1][1]})` : 'SQL';

  // Fallback Determinístico Rico
  let headline = `Mercado remoto abre ${total} oportunidades nas últimas 24h com ${brJobs.length} vagas diretas no Brasil`;
  let summary = `O levantamento de hoje destaca forte demanda em ${topStack1} e ${topStack2}. Foram mapeadas ${jrJobs.length} posições de entrada (Estágio/Júnior) e ${globalB2bJobs.length} contratos globais abertos para candidatos baseados no Brasil.`;
  let generatedBy = 'DETERMINISTIC_ENGINE';

  // Se houver chave gratuita do Google AI Studio (GEMINI_API_KEY), faz 1 única requisição leve ao Gemini Flash
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `Você é o Editor-Chefe de um Jornal Universitário de Vagas de Tecnologia (UNEMAT).
Dados da edição de hoje:
- Total de vagas remotas: ${total}
- Vagas no Brasil: ${brJobs.length}
- Vagas Estágio/Júnior: ${jrJobs.length}
- Contratos Globais B2B: ${globalB2bJobs.length}
- Stacks mais requisitadas hoje: ${topStack1}, ${topStack2}
- Top 3 vagas: ${topPicks.map(p => `${p.job.title} na ${p.job.company} (${p.job.location})`).join('; ')}

Retorne APENAS um JSON válido com 2 chaves:
{"headline": "manchete curta e impactante de até 14 palavras", "summary": "resumo analítico de 2 frases diretas para estudantes de computação e devs"}`;

      const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const parsed = JSON.parse(rawText);
              if (parsed.headline && parsed.summary) {
                headline = parsed.headline;
                summary = parsed.summary;
                generatedBy = 'GEMINI_FLASH_API';
                break;
              }
            }
          }
        } catch (innerErr) {
          // Tenta o próximo modelo
        }
      }
    } catch (e) {
      console.warn('Fallback editorial acionado:', e.message);
    }
  }

  return {
    headline,
    summary,
    generatedBy,
    stats: {
      total,
      brazil: brJobs.length,
      junior: jrJobs.length,
      globalB2b: globalB2bJobs.length,
      topStacks: sortedStacks.slice(0, 3).map(([name, count]) => ({ name, count }))
    },
    topPicks
  };
}

module.exports = { buildDailyEditorial };
