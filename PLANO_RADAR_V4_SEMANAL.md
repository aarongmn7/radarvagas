# 📐 Especificação Técnica (PRD) — Radar V4: Curadoria Semanal, Validação Live & Escopo Tech Expandido

**Status:** Planejado (Pronto para Implementação)  
**Repositório Alvo:** `pessoal/projetos pessoais/radar-web` (`aarongmn7/radarvagas`)  
**Objetivo:** Transformar o Radar Diário em um motor qualitativo multi-área (Ecossistema Tech), com armazenamento cíclico de Domingo a Sábado, filtro anti-vagas fantasmas (Ghost Jobs) e consolidador aos sábados à noite que valida quais vagas continuam abertas para a semana seguinte.

---

## 1. Fluxo do Ciclo Semanal (Domingo a Sábado + Purge)

| Dia / Evento | Horário (MT / Cuiabá) | Ação Automatizada | Arquivos Gerados / Afetados |
| :--- | :--- | :--- | :--- |
| **Domingo a Sábado** (Coleta Diária) | `07:50` | Varre as últimas 24h, atualiza o site do dia e salva cópia das vagas aprovadas no buffer semanal. | • Atualiza `data/jobs.json` e `data/vagas_do_dia.md`<br>• Cria `data/weekly/YYYY-MM-DD.json` |
| **Sábado à Noite** (Fechamento Semanal) | `20:00` | 1. Lê todos os arquivos de `data/weekly/*.json`<br>2. Deduplica por ID/URL da vaga<br>3. Filtra por Score qualitativo + Anti-Ghost<br>4. Testa HTTP ao vivo para confirmar que a vaga **ainda está aberta**<br>5. Gera o Relatório Semanal (sem limite artificial de vagas)<br>6. **Apaga** os arquivos `data/weekly/*.json` | • Atualiza `data/weekly_report.json`<br>• Atualiza `data/relatorio_semanal.md`<br>• Atualiza `data/seen_signatures.json`<br>• **Limpa** `data/weekly/*` |

---

## 2. Expansão de Escopo: Ecossistema de Tecnologia (6 Áreas)

O filtro deixará de bloquear Produto, Design e Marketing Digital desde que pertençam ao contexto de **Tecnologia, SaaS, Startups e Produtos Digitais**:

1. **`DEV` (Engenharia de Software):** Full Stack, Backend, Frontend, Mobile, Dados, DevOps, QA.
2. **`AI` (Inteligência Artificial & Automação):** AI Engineer, LLM/Agents, Machine Learning, Data Science, Automação.
3. **`SUPPORT` (Suporte Técnico, Sistemas & Infra):** Tech Support N1/N2/N3, Application Support, Analista de Sistemas, ERP/SAP, Customer Success Tech.
4. **`DESIGN` (Design de Produto & Digital):** Product Designer, UI/UX Designer, UX Researcher, Design Systems, Web/Motion Designer (foco SaaS/Tech).
5. **`PRODUCT` (Gestão de Produto & Agilidade):** Product Manager (PM), Product Owner (PO), Technical PM, Scrum Master, Agile Coach, Business Analyst.
6. **`MARKETING` (Growth & Tech Marketing):** Growth Marketing, Product Marketing Manager (PMM), SEO/Performance Tech, Tech Copywriter, DevRel, CRM/Lifecycle.

---

## 3. Motor Qualitativo & Anti-Ghost Jobs (Eliminação de Vagas Fantasmas)

Para garantir alta qualidade e evitar que o usuário perca tempo enviando currículo para vagas falsas ou saturadas:

### 3.1. Blacklist & Limite por Empresa (Anti-Farming)
* **Bloqueio/Penalização de Agregadores de Farming:** Empresas conhecidas por publicar centenas de vagas clones para captação massiva de banco de dados (ex: *BairesDev, Turing, Crossover, Jobot, Dice, Lensa, Canonical*) terão flag de alerta ou limite estrito de no máximo **1 vaga por área**, priorizando empresas reais de produto.

### 3.2. Rastreador de Reposting Infinito (`data/seen_signatures.json`)
* Gera uma assinatura única leve para cada vaga: `hash(empresa_normalizada + titulo_normalizado)`.
* Guarda apenas `{ hash: "firstSeenDate" }`.
* Se a mesma vaga da mesma empresa continuar sendo "republicada como nova" por mais de **21 dias**, ela é marcada como **Ghost Job (Repost Crônico)** e excluída do relatório de elite de sábado.

---

## 4. Algoritmo Econômico de Validação no Sábado à Noite (`scripts/build_weekly_report.js`)

Para não precisar testar milhares de links no sábado à noite, o funil opera em **3 estágios rápidos**:

1. **Estágio 1 — Unificação & Deduplicação (Memória - 0s):**
   * Junta `data/weekly/*.json` dos 7 dias. Se uma vaga apareceu em mais de um dia, mantém o registro mais rico.
2. **Estágio 2 — Corte Qualitativo por Score e Elegibilidade (Memória - 0s):**
   * Descarta vagas `🇺🇸 US Only (W2)` se o foco for aplicabilidade daqui, ou separa por elegibilidade (`🇧🇷 Remoto Nacional` e `🌎 Worldwide / LATAM B2B`).
   * Filtra apenas vagas com **Score >= 70** e que passaram no filtro Anti-Ghost.
3. **Estágio 3 — Check Ao Vivo de Vaga Aberta (Rede - ~2 a 4 min):**
   * Faz requisição GET leve para cada vaga aprovada no Estágio 2:
     * **LinkedIn Guest Page:** Verifica se **NÃO** contém `"No longer accepting applications"` / `"Não aceita mais candidaturas"` / `"Candidaturas encerradas"` e se o status HTTP é `200`.
     * **Portais Abertos (Remotive, Himalayas, Jobicy, Arbeitnow):** Verifica se a vaga continua ativa no endpoint ou retorna `200 OK`.
   * **Sem limite artificial:** Todas as vagas que continuarem abertas e aprovadas no Score entram no relatório final de sábado, agrupadas pelas 6 áreas.
4. **Estágio 4 — Purge (Limpeza):**
   * Remove todos os arquivos `.json` dentro de `data/weekly/` para iniciar o domingo limpo.

---

## 5. Checklist de Implementação Futura (Passo a Passo para Próxima Sessão)

- [ ] **Passo 1:** Atualizar `scripts/job_radar.js` e `scripts/build_jobs_data.js` com os 6 arquétipos (`DEV`, `AI`, `SUPPORT`, `DESIGN`, `PRODUCT`, `MARKETING`) e salvar cópia diária em `data/weekly/YYYY-MM-DD.json`.
- [ ] **Passo 2:** Adicionar o filtro Anti-Ghost (`seen_signatures.json` + filtro de empresas de farming).
- [ ] **Passo 3:** Criar `scripts/build_weekly_report.js` (consolidação + check ao vivo de vaga aberta + limpeza de `data/weekly/`).
- [ ] **Passo 4:** Adicionar aba **"🏆 Melhores da Semana (Abertas)"** e filtros das novas áreas no front-end (`index.html` e `app.js`).
- [ ] **Passo 5:** Adicionar segundo cronjob no `cron-job.org` para Sábado às `20:00` disparando a rotina semanal.
