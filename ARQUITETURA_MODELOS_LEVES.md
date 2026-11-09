# 📐 Guia de Manutenção Determinística — Radar Web (Low-Parameter Model Playbook)

> **ATENÇÃO PARA MODELOS RÁPIDOS (Flash / Lite / Low):**
> Este projeto utiliza **Arquitetura Determinística de 3 Camadas Estritas**. NUNCA altere o CSS ou HTML enquanto estiver editando a lógica de captura de dados, e NUNCA invente classes novas fora do Design System abaixo.

---

## 1. Contrato Imutável do `data/jobs.json`

Todo script em `scripts/` DEVE produzir exatamente este formato JSON:

```json
{
  "lastUpdated": "2026-10-31T23:48:00.000Z",
  "totalJobs": 132,
  "jobs": [
    {
      "id": "SA-14",
      "title": "Master Full Stack Developer (Python + React), Brazil",
      "company": "CI&T",
      "location": "Brazil",
      "geo": {
        "isBrazil": true,
        "isSouthAmerica": true,
        "isNorthAmerica": false,
        "isEurope": false,
        "isAsia": false,
        "isAfrica": false,
        "flag": "🇧🇷"
      },
      "archetype": "AI",
      "eligibility": "🌎 Worldwide / Contractor Friendly",
      "posted": "2 hours ago",
      "url": "https://br.linkedin.com/jobs/view/...",
      "score": 98,
      "matchReasons": ["React 19 no Dossiê", "Python no Dossiê"],
      "isStudentFriendly": false
    }
  ]
}
```

### Regras Geográficas Obrigatórias (`geo`):
- **`isBrazil`:** `true` apenas se a vaga for no Brasil.
- **`isSouthAmerica`:** `true` se for em qualquer país da América do Sul/LATAM **OU** se `isBrazil === true` (o Brasil faz parte da América do Sul).

---

## 2. Regras de Ouro de UI/UX (Anti-"IA Crua")

1. **Proibido Emojis Excessivos nos Botões:** Os botões de região e trilha usam tipografia `JetBrains Mono` limpa (`WORLD`, `BRA`, `SOUTH AME`, `NORTH AME`, `EUR`, `ASIA`, `AFRICA`).
2. **Paleta Monocromática Zinc (Padrão Portfólio Aaron):**
   - Tema Escuro: Fundo `#000000` (OLED), Cards `#09090b`, Bordas `#27272a`.
   - Tema Claro: Fundo `#ffffff`, Cards `#f4f4f5`, Bordas `#e4e4e7`.
3. **Header Oficial de 3 Colunas:**
   - Esquerda: Logo `assets/logo.svg` com inversão inteligente (`filter: grayscale(100%) brightness(0) invert(1)` no dark mode).
   - Centro: Pílula `.nav-list`.
   - Direita: `.status-pill` + `.theme-switch-container` + `.btn-contact`.

---

## 3. Comandos Rápidos de Operação

1. **Atualizar a varredura de vagas (24h):**
   ```powershell
   & "C:\TI\node\node.exe" .agents\skills\job-radar\scripts\job_radar.js all all 24
   ```
2. **Recompilar o JSON estruturado do site:**
   ```powershell
   & "C:\TI\node\node.exe" pessoal\radar-web\scripts\build_jobs_data.js
   ```
3. **Iniciar o servidor local:**
   ```powershell
   & "C:\TI\node\node.exe" pessoal\radar-web\scripts\server.js
   ```

---

## 4. 📌 Roadmap Futuro (Pendência Planejada V4)
- **[ ] Matcher Interativo de Currículo / Perfil do Visitante (Client-Side):**
  - Permitir que o estudante/visitante faça upload do seu próprio PDF/currículo (ou selecione suas stacks/nível na tela) e recalcule dinamicamente o `SCORE %` de todas as vagas do jornal especificamente para o perfil dele, 100% no navegador (Zero-Server Cost).
