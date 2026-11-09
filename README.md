# 📡 Boletim Diário de Vagas Remotas Tech — Radar Universitário (V3.5)

Jornal diário automatizado e **Zero-Dependency** de oportunidades 100% remotas para estudantes de Ciência da Computação, desenvolvedores Júnior/Pleno, Analistas de Sistemas/QA e Engenheiros de IA.

Atualizado automaticamente todos os dias às **06:00 BRT (09:00 UTC)** via GitHub Actions.

---

## ⚡ Arquitetura & Diferenciais de Engenharia

- **100% Zero-Dependency (Vanilla JS + Node.js Puro):** Nenhum pacote NPM externo no coletor ou no front-end. Construído apenas com APIs nativas (`fetch`, `fs`, `path`, `http`), garantindo execução ultrarrápida e manutenção determinística.
- **Coleta Multi-Rede Resiliente (Zero Ban Risk):**
  - Varre a API pública de convidados do **LinkedIn Guest** (sem cookies, sem login) combinada com **Himalayas**, **Jobicy**, **Arbeitnow** e **Remotive**.
  - Fila sequencial inteligente com rotação de User-Agent, cooldown adaptativo contra HTTP 429 e *Dead-Letter Queue* (2ª passagem automática).
- **Motor de Scoring & Curadoria Editorial:**
  - Calcula o índice de compatibilidade técnica (`SCORE %`) para cada vaga com base na stack (Node.js, React, TypeScript, Python, SQL, IA, Suporte/ERP), modalidade (`Remoto Nacional`, `Worldwide / Contractor B2B`) e nível de entrada (`Estágio / Júnior`).
  - Gera diariamente a **Manchete de Capa** e seleciona o **Top 3 Oportunidades de Ouro** (com suporte opcional ao Gemini Flash API + fallback determinístico).
- **Design System Monochrome (OLED Dark / Light):**
  - Interface responsiva em Bento Grid sincronizada com a identidade visual do portfólio de **Aaron Nascimento (`AARON.DEV`)**.

---

## 🚀 Como Executar Localmente

### 1. Iniciar o servidor web local
```bash
node scripts/server.js
```
Acesse em: `http://localhost:3000`

### 2. Executar nova varredura de vagas (últimas 24h)
```bash
node scripts/job_radar.js all all 24
```

### 3. Recompilar o banco JSON (`data/jobs.json`) e Editorial do Dia
```bash
node scripts/build_jobs_data.js
```

---

## 👨‍💻 Autor

**Aaron Nascimento** — Ciência da Computação (UNEMAT)
- 🌐 Portfólio: [aaron.dev.br](https://aaron.dev.br/)
- 💼 LinkedIn: [linkedin.com/in/aaron-nascimento-dev](https://www.linkedin.com/in/aaron-nascimento-dev/)
- 🐙 GitHub: [github.com/aarongmn7](https://github.com/aarongmn7)
