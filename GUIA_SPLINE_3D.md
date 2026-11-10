# 🪐 Guia & Prompts para Criar a Esfera 3D no Spline (Meio Globo / Meia Logo `AARON.DEV`)

> **Arquivo da sua Logo:** `pessoal/projetos pessoais/radar-web/assets/logo.svg`

---

## 1. Prompt para o **Spline AI** (Copie e cole no gerador AI do Spline)

Se você usar o **AI Prompt** dentro do Spline, cole exatamente este prompt em inglês (o Spline AI entende melhor em inglês):

```text
Create a futuristic monochrome 3D dual-sided coin-sphere floating in the center on a pure black OLED background (#000000). 
Side A (front hemisphere): A dark metallic brushed-steel emblem featuring a circular geometric monogram logo in high-relief silver chrome.
Side B (back hemisphere): A stylized glowing wireframe Earth globe with subtle white/emerald latitude-longitude grid lines and glowing data nodes representing global cities.
Add a smooth continuous Y-axis rotation (360 degrees loop in 12 seconds) and subtle mouse-follow tilt interaction. Studio rim lighting in cold white and subtle emerald green accent (#10b981).
```

---

## 2. Passo a Passo Manual Rápido no Spline (Usando sua `logo.svg` + Foto da Terra)

Como o seu `assets/logo.svg` usa `<clipPath>` e `skewX`, o importador 3D do Spline funciona muito melhor se você montar a esfera em **3 passos simples (leva 5 minutos)**:

### Passo 1: Criar o Meio Globo (Lado A)
1. No Spline, clique no ícone **`+` -> Sphere** (Esfera).
2. No painel direito (**Shape**):
   * **Size:** `X: 300`, `Y: 300`, `Z: 300`
   * **Slice (Corte de Meia Esfera):** Mude `Slice` para `180` (ou `0.5`) — isso transforma a esfera em **Meia Terra**!
3. No painel **Material**:
   * Clique em **`+`** e mude a camada para **Image / Texture**.
   * Suba a **foto do Globo/Terra** que você separou.
   * Adicione por cima uma camada **Fresnel** (cor `#10B981` ou `#FFFFFF`, intensidade `0.4`) para dar aquele brilho de radar nas bordas.

### Passo 2: Acoplar a Sua Logo Redonda 3D (Lado B)
1. Arraste o arquivo `assets/logo.svg` (ou a foto PNG da sua logo redonda) para dentro do palco do Spline.
2. Se importar como **SVG**:
   * No painel direito, aumente o **Extrusion (Relevo 3D)** para `25`.
   * Ative **Bevel** (`2`) para chanfrar as bordas do `AN` em estilo metálico.
   * No **Material**, escolha **Matcap** ou **Physical** (`Metalness: 0.9`, `Roughness: 0.2`, Cor: `#E5E7EB` prata cromado).
3. Se usar a **Foto da Logo** em uma segunda meia-esfera:
   * Duplique a meia-esfera (`Ctrl + D`), gire `180°` no eixo Y (`Rotation Y: 180`) para fechar a bola inteira, e aplique a imagem da sua logo na textura!

### Passo 3: Agrupar e Colocar para Girar Sozinha
1. Selecione a **Meia Terra** + **Meia Logo** e aperte `Ctrl + G` para criar um grupo (`Group: RadarCore`).
2. Com o grupo selecionado, vá na aba direita em **States** -> clique em **`+`** para criar o `State 2`:
   * No `State 2`, mude **Rotation Y** de `0` para `360`.
3. Vá em **Events** -> clique em **`+`**:
   * Tipo do evento: **Start**
   * Action: **Transition** -> Target: `RadarCore` -> State: `State 2`
   * **Duration:** `12s` | **Loop:** `Infinite` | **Cycle:** `Restart` | **Interpolation:** `Linear`.

---

## 3. Como Exportar do Spline para o nosso Site (`radar-web`)

1. No topo direito do Spline, clique em **Export**.
2. Escolha **Code Export -> Vanilla JS / Spline Viewer (Web Component)**.
3. Em **Play Settings**:
   * **Background Color:** `Hide` (Fundo Transparente para fundir com o preto OLED do site).
   * **Page Scroll:** `Yes` (para não travar o scroll da página).
4. Copie a tag `<spline-viewer url="https://prod.spline.design/.../scene.splinecode"></spline-viewer>` e me mande na próxima sessão que eu conecto os filtros orbitais ao redor dela!
