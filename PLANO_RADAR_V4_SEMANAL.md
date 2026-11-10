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

## 5. Redesign da Experiência de Busca (Hub Radial "On-Demand" / Zero-Scroll Inicial)

### 5.1. O Que Permanece Intacto
* **Dobra Superior (Hero + Métricas + Manchete de Capa + Top 3 Destaques):** Continua exatamente como está hoje (Bento Grid Monochrome OLED Dark/Light).

### 5.2. Nova Experiência na Seção de Vagas (Conceito "Orbital / Hub Central")
Substituir a caixa de filtro retangular e a listagem infinita pré-carregada por uma **experiência visual guiada sob demanda**:

1. **Estado Inicial (Zero-Scroll / Sem Lista de Vagas):**
   * Ao rolar além do Top 3 Destaques, **nenhum card de vaga é renderizado inicialmente** (elimina o scroll infinito imediato e a sobrecarga visual de 1.000+ cards).
   * A página termina exatamente no **Hub Orbital de Exploração**.

2. **Anatomia do Hub Orbital (Baseado no Sketch Oficial + Núcleo 3D):**
   * **Barra de Pesquisa Dinâmica (Sincronizada com a Animação):**
     * A barra de busca (`input`) permanece em destaque logo acima/integrada ao núcleo.
     * **Sincronia Busca ↔ Nodos:** Conforme o usuário digita (ex: `"React"`, `"Python"`, `"Brazil"`, `"Design"`), os nodos correspondentes ao redor da esfera **acendem/pulsam automaticamente na animação** indicando os filtros ativados em tempo real.
   * **Centro (Moeda/Esfera 3D Dupla Face — Meio Globo / Meia Logo `AARON.DEV`):**
     * **Conceito Visual:** Um objeto 3D esférico/orbital girando continuamente no centro:
       * **Face A (Hemisfério 1):** Globo terrestre estilizado (wireframe/pontos luminosos representando os países rastreados).
       * **Face B (Hemisfério 2):** A **Logo Redonda `AARON.DEV`** modelada em 3D com relevo e textura metálica/monochrome (OLED Dark/Silver).
     * *(Nota: O avatar do rosto seguindo o mouse fica reservado exclusivamente para o Portfólio principal, mantendo o Radar com estética de artefato tecnológico global).*
   * **Arco Esquerdo — `PAÍSES / REGIÕES` (Nodos Orbitais):**
     * Pílulas/nodos dispostos em arco à esquerda da esfera: `WORLD`, `BRAZIL`, `LATAM`, `NORTH AMERICA`, `EUROPE`, `ASIA/PACIFIC`, `MIDDLE EAST`.
   * **Arco Direito — `VAGAS / TRILHAS` (Nodos Orbitais):**
     * Pílulas/nodos dispostos em arco à direita da esfera com as áreas: `Estágio & Júnior`, `Engenharia & Dev`, `IA & Automação`, `Suporte & Sistemas`, `Design Digital`, `Produto & PM`, `Growth & Marketing`.
   * **Arco Inferior — `OPÇÕES ADICIONAIS` (Toggles Rápidos):**
     * Nodos na base do núcleo: `⚡ Simplificada (1-Click)`, `🌎 Worldwide / B2B`, `🏆 Melhores da Semana (Edição de Sábado)`.

---

## 5.3. Ferramentas Recomendadas para Criar a Esfera 3D (Meio Globo / Meia Logo)

Para criar e rodar esse ativo 3D no centro do site sem pesar o carregamento na Vercel:

1. **Spline.design (🏆 Mais Recomendado para Web Interativa):**
   * **O que é:** Ferramenta 3D direto no navegador (estilo Figma, porém 3D) gratuita.
   * **Como fazer lá:** Você importa o arquivo `.svg` da sua logo redonda `AARON.DEV`, aplica extrusão 3D + textura metálica/vidro fosco de um lado, acopla a meia esfera do globo do outro e coloca uma animação de rotação contínua (e reação ao mouse).
   * **Como entra no site:** Exporta como embed leve ou WebGL Canvas (`<spline-viewer>`).
2. **Three.js Puro via Código (Zero Ferramenta Externa):**
   * Podemos gerar a esfera direto via código JavaScript no próprio site (`Three.js` via CDN): um hemisfério com shader de pontos dos continentes e o outro hemisfério extrudando o seu `assets/logo.svg` em 3D com iluminação reativa ao filtro.
3. **Blender → Exportação `.GLB` + `<model-viewer>` do Google:**
   * Se quiser esculpir com textura ultra-detalhada no Blender, exporta um único arquivo `.glb` (< 1MB) e roda nativo no HTML.

3. **Comportamento de Revelação Sob Demanda (Click-to-Reveal):**
   * As vagas ficam ocultas (`display: none` / container recolhido) até que o usuário clique em qualquer nodo (País, Área, Opção Adicional ou pesquise no centro).
   * Ao clicar em uma opção, o nodo acende (estado ativo), o centro atualiza a contagem exata do cruzamento e a **grade de vagas se revela abaixo com transição suave (`fade-in + slide-down`)**, fazendo scroll suave até os resultados.
   * Se o usuário desmarcar tudo ou clicar em "Fechar/Resetar Radar", a lista se recolhe novamente, voltando ao estado limpo sem scroll.

---

## 6. Checklist de Implementação Futura (Passo a Passo para Próxima Sessão)

- [ ] **Passo 1:** Atualizar `scripts/job_radar.js` e `scripts/build_jobs_data.js` com os 6 arquétipos (`DEV`, `AI`, `SUPPORT`, `DESIGN`, `PRODUCT`, `MARKETING`) e salvar cópia diária em `data/weekly/YYYY-MM-DD.json`.
- [ ] **Passo 2:** Adicionar o filtro Anti-Ghost (`seen_signatures.json` + filtro de empresas de farming).
- [ ] **Passo 3:** Criar `scripts/build_weekly_report.js` (consolidação + check ao vivo de vaga aberta + limpeza de `data/weekly/`).
- [ ] **Passo 4 (UI Orbital & Zero-Scroll Inicial):** Substituir a barra de filtros tradicional em `index.html`, `style.css` e `app.js` pelo **Hub Orbital Central** (Arte/Filtro no meio, Países à esquerda, Vagas/Trilhas à direita, Opções Adicionais embaixo) e ocultar a grade de cards até que o usuário interaja.
- [ ] **Passo 5:** Adicionar segundo cronjob no `cron-job.org` para Sábado às `20:00` disparando a rotina semanal.

