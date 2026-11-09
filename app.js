// ============================================================================
// RADAR UNIVERSITÁRIO — MOTOR DETERMINÍSTICO V3 (PORTFOLIO DESIGN SYSTEM)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  let allJobs = [];
  let filteredJobs = [];

  // Referências DOM
  const jobsGrid = document.getElementById('jobs-grid');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const searchStats = document.getElementById('search-stats');
  const timerText = document.getElementById('timer-text');
  const themeCheckbox = document.getElementById('theme-checkbox');

  // Métricas Hero & Telemetria
  const statTotal = document.getElementById('stat-total');
  const statBra = document.getElementById('stat-bra');
  const statJr = document.getElementById('stat-jr');
  const heroLastUpdated = document.getElementById('hero-last-updated');
  const heroNextUpdate = document.getElementById('hero-next-update');
  const exactSyncDate = document.getElementById('exact-sync-date');
  const syncProgressBar = document.getElementById('sync-progress-bar');

  // Controles de Filtro
  const continentBtns = document.querySelectorAll('#continent-pills .seg-btn');
  const archetypePills = document.querySelectorAll('#archetype-pills .pill');
  const headerNavLinks = document.querySelectorAll('.nav-list a[data-quick-arch]');
  const easyApplyCheck = document.getElementById('only-easy-apply-check');
  const contractorCheck = document.getElementById('only-contractor-check');
  const studentCheck = document.getElementById('only-student-check');
  const sortSelect = document.getElementById('sort-select');
  const resetBtn = document.getElementById('reset-filters-btn');

  // Referências Pilares do Jornal (Streak, Editorial e Compartilhamento)
  const streakCountEl = document.getElementById('streak-count');
  const streakBadgeEl = document.getElementById('streak-badge');
  const editorialHeadlineEl = document.getElementById('editorial-headline');
  const editorialSummaryEl = document.getElementById('editorial-summary');
  const editorialEngineBadge = document.getElementById('editorial-engine-badge');
  const topPicksGrid = document.getElementById('top-picks-grid');
  const shareEditionBtn = document.getElementById('share-edition-btn');
  const copyEditionBtn = document.getElementById('copy-edition-btn');
  const shareToast = document.getElementById('share-toast');
  const shareToastText = document.getElementById('share-toast-text');
  let currentEditorial = null;

  // Estado Único Determinístico
  const state = {
    search: '',
    continent: 'WORLD',
    archetype: 'all',
    onlyEasyApply: false,
    onlyContractor: false,
    onlyStudent: false,
    sort: 'score-desc'
  };

  // 1. Gestão do Tema (Sincronizado com o Switch Deslizante do Portfólio)
  const savedTheme = localStorage.getItem('radar-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeCheckbox) {
    themeCheckbox.checked = savedTheme === 'dark';
    themeCheckbox.addEventListener('change', (e) => {
      const nextTheme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('radar-theme', nextTheme);
    });
  }

  // 1.5 Pilar 2: Retenção Sem Login (Streak Diária de Leitura via localStorage)
  function initDailyStreak() {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const lastVisit = localStorage.getItem('radar_last_visit_date');
      let streak = parseInt(localStorage.getItem('radar_streak_count') || '0', 10);

      if (!lastVisit) {
        streak = 1;
      } else if (lastVisit !== todayKey) {
        const prevDate = new Date(lastVisit + 'T00:00:00');
        const currDate = new Date(todayKey + 'T00:00:00');
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else {
          streak = 1;
        }
      }

      localStorage.setItem('radar_last_visit_date', todayKey);
      localStorage.setItem('radar_streak_count', String(streak));

      if (streakCountEl) {
        streakCountEl.textContent = `${streak} ${streak === 1 ? 'dia' : 'dias'}`;
      }
      if (streakBadgeEl) {
        streakBadgeEl.title = `Você acompanhou o jornal por ${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}!`;
      }
    } catch (e) {
      console.warn('Streak localStorage indisponível:', e);
    }
  }
  initDailyStreak();

  // 2. Carregamento do Banco JSON
  fetch('data/jobs.json')
    .then(res => {
      if (!res.ok) throw new Error('Erro HTTP ao ler data/jobs.json');
      return res.json();
    })
    .then(data => {
      const lastUpdatedStr = data.lastUpdated || null;
      allJobs = Array.isArray(data) ? data : (data.jobs || []);
      currentEditorial = data.editorial || null;

      updateMetricsAndCounts(allJobs);
      renderEditorial(currentEditorial, allJobs);

      if (lastUpdatedStr) {
        startLiveTimer(lastUpdatedStr);
      } else if (timerText) {
        timerText.textContent = 'Sincronizado hoje';
      }

      applyFilters();
    })
    .catch(err => {
      console.error('Erro ao inicializar radar:', err);
      if (timerText) timerText.textContent = 'Offline';
      jobsGrid.innerHTML = `<div class="empty-state"><div class="empty-code">ERR // DATA_LOAD</div><h3>Falha ao carregar data/jobs.json</h3></div>`;
    });

  // 3. Atualiza Métricas do Topo e Contadores nas Pílulas de Região
  function updateMetricsAndCounts(jobs) {
    const braCount = jobs.filter(j => j.geo && j.geo.isBrazil).length;
    const saCount = jobs.filter(j => j.geo && j.geo.isSouthAmerica).length;
    const naCount = jobs.filter(j => j.geo && j.geo.isNorthAmerica).length;
    const euCount = jobs.filter(j => j.geo && j.geo.isEurope).length;
    const asiaCount = jobs.filter(j => j.geo && j.geo.isAsia).length;
    const africaCount = jobs.filter(j => j.geo && j.geo.isAfrica).length;
    const jrCount = jobs.filter(j => j.isStudentFriendly).length;

    if (statTotal) statTotal.textContent = jobs.length;
    if (statBra) statBra.textContent = saCount;
    if (statJr) statJr.textContent = jrCount;

    const setChip = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `(${val})`;
    };

    setChip('cnt-WORLD', jobs.length);
    setChip('cnt-BRA', braCount);
    setChip('cnt-SOUTH_AME', saCount);
    setChip('cnt-NORTH_AME', naCount);
    setChip('cnt-EUR', euCount);
    setChip('cnt-ASIA', asiaCount);
    setChip('cnt-AFRICA', africaCount);
  }

  // 3.5 Pilar 3: Renderiza a Capa Editorial + Top 3 Vagas de Ouro
  function renderEditorial(editorial, jobs) {
    if (!editorial) return;

    if (editorialHeadlineEl && editorial.headline) {
      editorialHeadlineEl.textContent = editorial.headline;
    }
    if (editorialSummaryEl && editorial.summary) {
      editorialSummaryEl.textContent = editorial.summary;
    }
    if (editorialEngineBadge) {
      editorialEngineBadge.textContent = editorial.generatedBy === 'GEMINI_FLASH_API'
        ? 'IA EDITORIAL // GEMINI FLASH'
        : 'CURADORIA AUTOMÁTICA // DADOS REAIS';
    }

    if (topPicksGrid && Array.isArray(editorial.topPicks)) {
      topPicksGrid.innerHTML = editorial.topPicks.map(item => {
        const j = item.job;
        if (!j) return '';
        const cleanElig = (j.eligibility || 'Remoto').replace(/^[🌎🌐🇺🇸🇧🇷]\s*/, '');
        return `
          <article class="top-pick-card">
            <div>
              <div class="top-pick-badge-row">
                <span class="top-pick-badge">★ ${escapeHtml(item.badge)}</span>
                <span class="match-pill high">SCORE ${j.score}%</span>
              </div>
              <h3 class="top-pick-title" style="margin-top: 0.7rem;">${escapeHtml(j.title)}</h3>
              <div class="top-pick-company">${escapeHtml(j.company)} • ${j.geo?.flag || '🌐'} ${escapeHtml(j.location)}</div>
            </div>
            <div class="top-pick-footer">
              <span>${escapeHtml(cleanElig)}</span>
              <a href="${j.url}" target="_blank" rel="noopener noreferrer" class="btn-open-job">
                Ver Vaga <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.68rem;"></i>
              </a>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  // 3.6 Pilar 1: Motor de Viralização da Edição Completa (WhatsApp / Copiar Boletim)
  function buildNewspaperShareText() {
    const total = allJobs.length || 120;
    const brCount = allJobs.filter(j => j.geo && j.geo.isBrazil).length;
    const jrCount = allJobs.filter(j => j.isStudentFriendly).length;
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const siteUrl = window.location.href.split('#')[0];
    const headline = currentEditorial?.headline || `${total} vagas 100% remotas mapeadas nas últimas 24h`;

    return [
      `🗞️ *BOLETIM DIÁRIO DE VAGAS TECH (${todayStr})*`,
      `_${headline}_`,
      ``,
      `📊 *Resumo da Edição de Hoje:*`,
      `• 🌐 *${total}* vagas remotas abertas nas últimas 24h`,
      `• 🇧🇷 *${brCount}* vagas diretas no Brasil`,
      `• 🎓 *${jrCount}* oportunidades de Entrada (Estágio / Júnior)`,
      ``,
      `🔗 *Acesse o jornal completo e filtre por stack:*`,
      `${siteUrl}`
    ].join('\n');
  }

  function showShareToast(msg) {
    if (!shareToast) return;
    if (shareToastText && msg) shareToastText.textContent = msg;
    shareToast.classList.add('show');
    setTimeout(() => {
      shareToast.classList.remove('show');
    }, 3400);
  }

  if (shareEditionBtn) {
    shareEditionBtn.addEventListener('click', () => {
      const text = buildNewspaperShareText();
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    });
  }

  if (copyEditionBtn) {
    copyEditionBtn.addEventListener('click', async () => {
      const text = buildNewspaperShareText();
      try {
        await navigator.clipboard.writeText(text);
        showShareToast('Boletim da edição copiado! Cole no grupo da faculdade.');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showShareToast('Boletim da edição copiado! Cole no grupo da faculdade.');
      }
    });
  }

  // 4. Relógio do Jornal Diário de Vagas (Varredura Real + Próxima Edição)
  function startLiveTimer(isoDateStr) {
    const sweepTime = new Date(isoDateStr).getTime();
    const cycleMs = 24 * 60 * 60 * 1000;
    const heroLastExactSub = document.getElementById('hero-last-exact-sub');
    const editionBadge = document.getElementById('edition-badge');

    const d = new Date(sweepTime);
    const pad = (n) => String(n).padStart(2, '0');
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const formattedHour = `${pad(d.getHours())}:${pad(d.getMinutes())} BRT`;

    if (exactSyncDate) {
      exactSyncDate.textContent = `REPO SYNC: ${formattedDate}`;
    }
    if (editionBadge) {
      editionBadge.textContent = `// EDIÇÃO DO DIA (${formattedDate}) • JORNAL DIÁRIO DE VAGAS REMOTAS`;
    }
    if (heroLastExactSub) {
      heroLastExactSub.textContent = `Push publicado às ${formattedHour}`;
    }

    function tick() {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - sweepTime);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elH = Math.floor(elapsedSec / 3600);
      const elM = Math.floor((elapsedSec % 3600) / 60);
      const elS = elapsedSec % 60;

      // Calcula a próxima edição diária:
      // Se o levantamento foi feito há menos de 24h, a próxima edição oficial é 24h após o levantamento (ou às 06:00 BRT da manhã seguinte)
      let nextEdition = new Date(now);
      nextEdition.setHours(6, 0, 0, 0);
      if (nextEdition.getTime() <= now) {
        nextEdition.setDate(nextEdition.getDate() + 1);
      }
      const nextTargetTime = nextEdition.getTime();

      const remainingMs = Math.max(0, nextTargetTime - now);
      const remSec = Math.floor(remainingMs / 1000);
      const remH = Math.floor(remSec / 3600);
      const remM = Math.floor((remSec % 3600) / 60);
      const remS = remSec % 60;

      // Relógio Esquerdo: Há quanto tempo a varredura de vagas do dia foi feita
      if (heroLastUpdated) {
        if (elH > 0) {
          heroLastUpdated.textContent = `Há ${pad(elH)}h ${pad(elM)}m ${pad(elS)}s`;
        } else {
          heroLastUpdated.textContent = `Há ${pad(elM)}m ${pad(elS)}s`;
        }
      }

      // Relógio Direito: Contagem regressiva até a edição de amanhã às 06:00 BRT
      if (heroNextUpdate) {
        heroNextUpdate.textContent = `${pad(remH)}h ${pad(remM)}m ${pad(remS)}s`;
      }

      // Barra de progresso até a nova edição das 06:00
      if (syncProgressBar) {
        const pct = Math.min(100, Math.max(4, ((cycleMs - remainingMs) / cycleMs) * 100));
        syncProgressBar.style.width = `${pct.toFixed(1)}%`;
      }

      // Pílula do topo
      if (timerText) {
        timerText.textContent = `Repo Sync: ${formattedHour} • Próx: ${pad(remH)}h ${pad(remM)}m`;
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  // 5. Renderização dos Cards em Bento Architecture
  function renderJobs(jobs) {
    if (searchStats) {
      searchStats.textContent = `${jobs.length} vaga${jobs.length === 1 ? '' : 's'}`;
    }

    if (jobs.length === 0) {
      jobsGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    jobsGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    jobsGrid.innerHTML = jobs.map(job => {
      const archLower = (job.archetype || 'DEV').toLowerCase();
      const isHighMatch = job.score >= 85;
      const cleanEligibility = (job.eligibility || 'Global Remote').replace(/^[🌎🌐🇺🇸🇧🇷]\s*/, '');
      const reasons = Array.isArray(job.matchReasons) ? job.matchReasons : [];

      return `
        <article class="bento-job-card">
          <div>
            <!-- Header Técnico Bento -->
            <div class="card-tech-header">
              <span class="card-meta-id">
                <span class="arch-dot ${archLower}"></span>
                ${escapeHtml(job.id)} // ${escapeHtml(job.archetype)}
              </span>
              <span class="match-pill ${isHighMatch ? 'high' : ''}">
                SCORE ${job.score}%
              </span>
            </div>

            <!-- Cargo & Empresa -->
            <h3 class="card-role-title">${escapeHtml(job.title)}</h3>
            <div class="card-company-row">
              <span>${escapeHtml(job.company)}</span>
            </div>

            <!-- Caixa de Especificações Estruturadas -->
            <div class="card-specs-box">
              <div class="spec-item">
                <span class="spec-key">LOCALIZAÇÃO</span>
                <span class="spec-val">${job.geo?.flag || '🌐'} ${escapeHtml(job.location)}</span>
              </div>
              <div class="spec-item">
                <span class="spec-key">MODALIDADE</span>
                <span class="spec-val">${escapeHtml(cleanEligibility)}</span>
              </div>
            </div>

            <!-- Chips Técnicos de Compatibilidade -->
            <div class="card-reasons">
              ${job.isStudentFriendly ? `<span class="reason-chip jr">ESTÁGIO / JÚNIOR</span>` : ''}
              ${reasons.map(r => `<span class="reason-chip">${escapeHtml(r)}</span>`).join('')}
            </div>
          </div>

          <!-- Rodapé de Ação -->
          <div class="card-action-footer">
            <span class="card-timestamp">${escapeHtml(job.posted || 'Recente')}</span>
            <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="btn-open-job">
              Candidatar <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem;"></i>
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  // 6. Motor de Filtragem Determinístico
  function applyFilters() {
    filteredJobs = allJobs.filter(job => {
      // Busca Textual
      if (state.search) {
        const q = state.search.toLowerCase();
        const hay = `${job.title} ${job.company} ${job.location} ${job.archetype} ${job.eligibility} ${(job.matchReasons || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Filtro de Região / Continente
      if (state.continent === 'BRA') {
        if (!job.geo || !job.geo.isBrazil) return false;
      } else if (state.continent === 'SOUTH_AME') {
        if (!job.geo || !job.geo.isSouthAmerica) return false;
      } else if (state.continent === 'NORTH_AME') {
        if (!job.geo || !job.geo.isNorthAmerica) return false;
      } else if (state.continent === 'EUR') {
        if (!job.geo || !job.geo.isEurope) return false;
      } else if (state.continent === 'ASIA') {
        if (!job.geo || !job.geo.isAsia) return false;
      } else if (state.continent === 'AFRICA') {
        if (!job.geo || !job.geo.isAfrica) return false;
      }

      // Filtro de Trilha / Arquétipo
      if (state.archetype === 'student') {
        if (!job.isStudentFriendly) return false;
      } else if (state.archetype !== 'all') {
        if (job.archetype !== state.archetype) return false;
      }

      // Toggle Candidatura Simplificada (Easy Apply)
      if (state.onlyEasyApply) {
        if (!job.isEasyApply) return false;
      }

      // Toggle Worldwide / Contractor
      if (state.onlyContractor) {
        const elig = (job.eligibility || '').toLowerCase();
        if (!elig.includes('worldwide') && !elig.includes('contractor')) return false;
      }

      // Toggle Estudante / Júnior
      if (state.onlyStudent) {
        if (!job.isStudentFriendly) return false;
      }

      return true;
    });

    // Ordenação
    if (state.sort === 'score-desc') {
      filteredJobs.sort((a, b) => b.score - a.score);
    } else if (state.sort === 'recent') {
      const parseDateScore = (j) => {
        if (j.postedIso) return j.postedIso;
        const m = (j.posted || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '0000-00-00';
      };
      filteredJobs.sort((a, b) => {
        const cmp = parseDateScore(b).localeCompare(parseDateScore(a));
        return cmp !== 0 ? cmp : (b.score - a.score);
      });
    }

    renderJobs(filteredJobs);
  }

  // 7. Listeners Interativos
  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    applyFilters();
  });

  continentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      continentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.continent = btn.getAttribute('data-continent');
      applyFilters();
    });
  });

  function syncArchetypeUI(archValue) {
    state.archetype = archValue;
    archetypePills.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === archValue);
    });
    headerNavLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-quick-arch') === archValue);
    });
    applyFilters();
  }

  archetypePills.forEach(pill => {
    pill.addEventListener('click', () => {
      syncArchetypeUI(pill.getAttribute('data-filter'));
    });
  });

  headerNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      syncArchetypeUI(link.getAttribute('data-quick-arch'));
      document.getElementById('vagas')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  if (easyApplyCheck) {
    easyApplyCheck.addEventListener('change', (e) => {
      state.onlyEasyApply = e.target.checked;
      applyFilters();
    });
  }

  contractorCheck.addEventListener('change', (e) => {
    state.onlyContractor = e.target.checked;
    applyFilters();
  });

  studentCheck.addEventListener('change', (e) => {
    state.onlyStudent = e.target.checked;
    applyFilters();
  });

  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters();
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.search = '';
      state.continent = 'WORLD';
      state.archetype = 'all';
      state.onlyEasyApply = false;
      state.onlyContractor = false;
      state.onlyStudent = false;
      state.sort = 'score-desc';

      searchInput.value = '';
      if (easyApplyCheck) easyApplyCheck.checked = false;
      contractorCheck.checked = false;
      studentCheck.checked = false;
      sortSelect.value = 'score-desc';

      continentBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-continent') === 'WORLD'));
      syncArchetypeUI('all');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
