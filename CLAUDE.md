# Fluxe — Meta Ad Generator (Autonomous Mode)

## BEHAVIOUR
When the user sends photos + a listing link:
1. Start working IMMEDIATELY. No questions unless absolutely blocked.
2. Scrape the listing URL automatically — extract: typology, location, price, area (m²), bedrooms, bathrooms, key features
3. Use vision to identify which photo is the exterior (wide shot, building facade, street view) and which are interiors — never ask
4. Read /memory/approved/ to understand what has worked before
5. Read /memory/learnings.md for accumulated insights
6. Generate 3 ad VARIATIONS with different copy angles
7. Deliver all 3 PNGs to /outputs
8. Show the user all 3 and ask: "Which do you approve? (1, 2, 3, or combinations)"
9. Save approved ads to /memory/approved/ and update learnings.md

## GENERATING VARIATIONS
Always produce exactly 3 variations:
- Variation A: price-focused hook ("T2 em Seixal por 244.000€ — veja porquê vale cada euro")
- Variation B: location/lifestyle hook ("Torre da Marinha, Seixal — o apartamento que não fica no mercado")
- Variation C: opportunity/urgency hook ("OPORTUNIDADE: T2 em Seixal com preço abaixo do mercado")
Each variation has different copy but same visual layout unless learnings.md suggests otherwise.

## GENERATING ADS — HOW TO RUN
Use the scripts in /scripts/:

```bash
# 1. Scrape listing data
node scripts/scrape-listing.js <URL>

# 2. Classify photos
node scripts/detect-photos.js <photo1> <photo2> <photo3>

# 3. Generate all 3 ad variations
node scripts/generate-ad.js

# 4. Save feedback after user review
node scripts/save-feedback.js approve|reject <png-path> [note]
```

Or use generate-ad.js programmatically — it chains everything internally.

## VISUAL LAYOUT (mandatory — match reference examples in /examples/)
1080x1080px — rendered via Puppeteer from HTML:

TOP (455px): exterior photo full-width, object-fit: cover
  ├── AMI license number: top center, small white text (e.g. "AMI 8451")
  └── "OPORTUNIDADE!" badge: BOTTOM of photo zone (~22px from bottom), centered red pill

MIDDLE (310px): white background, all items centered
  ├── "Venda – [Localidade]" — "Venda" bold #222, rest gray #888, 22px
  ├── "Apartamento [Tipologia]" — black #111, 74px, weight 900, letter-spacing -2px
  ├── Specs row: 🏠 [m²]  🛏 [N] Quartos  🚿 [N] WC — bold 22px, gap 36px
  └── Pills row: price pill (#FFD600 black text, 34px) + "SAIBA MAIS" pill (#E8232A white, 30px)

BOTTOM (315px): interior 1 (left 540px) + interior 2 (right 540px), object-fit: cover

Colors: badge/CTA #E8232A · price #FFD600 · background #ffffff · text #111/#888
Font: Arial, Helvetica (system fonts only, no external deps)
Output: always 1080×1080 PNG via Puppeteer

## AMI NUMBER
Fluxe's AMI license is 8451. Always render "AMI 8451" at top center of the exterior photo.

## COPY STRUCTURE (for each variation, in PT-PT)
Hook: [Tipologia] em [Localidade] — [Preço]€
Opening: 2-3 sentences, direct, local, emotional + rational
Features (bullets •): area, bedrooms, bathrooms, standout features
"Porque ver este imóvel?": 3-4 short reasons
CTA: "Agenda já a tua visita técnica! Clica no link, preenche o formulário e marca a tua visita."

## MEMORY & SELF-IMPROVEMENT
After user feedback:
- Approved ads → copy to /memory/approved/[date]-[location]-[typology]-v[n].png
- Rejected ads → copy to /memory/rejected/ with a note
- Update /memory/learnings.md with:
  * What visual/copy pattern was approved
  * What was rejected and why (if user said)
  * Running patterns: what hooks convert, what layouts get approved

Before generating, always read:
  * Last 5 approved ads in /memory/approved/
  * /memory/learnings.md
  * Reference examples in /examples/

Over time, evolve the variations based on what gets approved most.

## LISTING SCRAPERS
Scraper runs in two layers automatically:
1. **Firecrawl** (primary) — handles JS-rendered pages, bot protection, returns clean markdown. Requires `FIRECRAWL_API_KEY` env var.
2. **Cheerio/axios** (fallback) — CSS selector scraping, always runs as complement to fill any gaps.

Supported portals: remax.pt · era.pt · idealista.pt · imovirtual.com · casasapo.pt · supercasa.pt

To activate Firecrawl, set the env var before running:
```
$env:FIRECRAWL_API_KEY="fc-your-key-here"
node scripts/scrape-listing.js <URL>
```
Get a free API key at firecrawl.dev. If not set, cheerio fallback runs automatically.
If scraping fails entirely, extract whatever is visible and proceed — never stop to ask.

## PHOTO HANDLING
Photos arrive either:
a) Dropped into /inputs/ folder
b) Shared directly in chat (save them to /inputs/temp/ automatically)

Use vision to classify: exterior vs interior 1 vs interior 2
If only 2 photos: use exterior + 1 interior (duplicate interior for bottom row, slightly cropped differently)
If 4+ photos: pick the best exterior and best 2 interiors based on lighting and composition

## OUTPUT
Always deliver **both formats** for every ad:
- **Square** (1080×1080): `outputs/[name].png` — for feed
- **Story** (1080×1920): `outputs/[name]-story.png` — for Stories/Reels

If user asks for 5 ads → deliver 5 square + 5 story (10 files total).
`generateAd()` now returns `{ square, story }` automatically — both are always generated.

Story layout differences vs square:
- Top photo zone: 790px (vs 500px) with tilt-shift blur effect + scale(1.12)
- Single red "SAIBA MAIS" pill (no yellow price pill)
- Interior zone: 765px tall (vs 370px)

Always deliver:
1. PNG files in /outputs/ (both formats)
2. Copy block printed in chat (see COPY BLOCK below)
3. Ask: "Quais aprovamos? Diz-me os números e guardo na memória."

## COPY BLOCK (obrigatório — gerar sempre junto com os PNGs)
Para cada listing, gerar automaticamente em PT-PT:

REGRAS OBRIGATÓRIAS DE ESTILO:
- Proibido usar travessão "—" em qualquer copy. Substituir por vírgula, ponto ou reformular a frase.
- Sempre PT-PT: gramática, pontuação e acentuação correctas. Nunca PT-BR.
- No copy, títulos, formulário e email, usar SEMPRE a palavra completa do tipo de imóvel:
  - Apartamento T2, Apartamento T3, etc. (nunca só "T2" ou "T3")
  - Moradia T3, Moradia T4, etc.
  - Terreno, Loja, Espaço Comercial, etc.
  Nunca omitir o tipo — o lead tem de perceber imediatamente o que é.
- Em caso de dúvida gramatical ou ortográfica, usar SEMPRE o WebSearch para verificar antes de entregar o copy. Nunca adivinhar.
- PREPOSIÇÃO DE LOCALIDADE (regra PT-PT obrigatória):
  A preposição "em" contrai com o artigo definido da localidade:
  - Localidade com artigo feminino (da/das): usar "na" → "na Charneca da Caparica", "na Cova da Piedade"
  - Localidade com artigo masculino (do/dos): usar "no" → "no Pinhal do General", "no Seixal"
  - Localidade sem artigo: usar "em" → "em Amora", "em Setúbal", "em Botequim"
  NUNCA escrever "em Charneca da Caparica", "em Cova da Piedade", "em Pinhal do General".

### 1. Anúncio META (copy + títulos)
Copy body — estrutura APROVADA em campanha (usar sempre este formato):

🏠 [Tipo completo] [Tipologia] [prep+Localidade] por apenas [Preço]
[1 frase sobre localização/destaque principal — proximidade a praia, vista, zona, etc.]
[1 frase sobre uso — habitação própria e/ou investimento, valorização, etc.]

📍 Características principais:
[N] quartos [adjectivo]
[N] casa(s) de banho [adjectivo]
[X] m² de área bruta
[X] m² de área útil (se disponível)
[Ano de construção ou remodelação]
[Feature adicional relevante]

Porque faz sentido ver este [tipo]?

✅ [Razão 1 — localização específica]
✅ [Razão 2 — comércio, serviços, transportes]
✅ [Razão 3 — valorização / investimento]
✅ [Razão 4 — lifestyle / tranquilidade / conforto]

🔑 Agenda já a tua visita! Não deixes escapar, [tipo] com esta [característica] não ficam no mercado por muito tempo.
👉 Clica no link, preenche o formulário e marca a tua visita.

REGRAS DO COPY BODY:
- Tutear sempre: "agenda", "tua", "clica", "preenche", "marca", "deixes"
- Preço na 1ª linha com "por apenas"
- Características em lista limpa (sem emojis por linha, só texto)
- 4 razões com ✅, específicas ao imóvel e localização
- CTA duplo: 🔑 urgência + 👉 acção

Títulos (5 variações para A/B test) — FORMATO CURTO obrigatório:
🏡 [Tipo] [Tipologia] [prep+Localidade] - [Preço]
🌊 [Tipo] [Tipologia] [prep+Localidade] - [Feature destaque]
📐 [Tipo] [Tipologia] [prep+Localidade] - [Área]m²
🏠 [Tipo] [Tipologia] [prep+Localidade] - [N] Quartos
💰 [Tipo] [Tipologia] [prep+Localidade] - [Feature secundária]
Exemplo: "🏡 Moradia T4 na Charneca da Caparica - 615.000€"
NUNCA usar frases longas — apenas tipo + localidade + traço + 1 stat.

### 2. Formulário META (saudação do lead form)
Título: 🏡 [Apartamento/Moradia/etc.] [Tipologia] – [Localidade]
Descrição (bullets com emojis):
🛏️ [N] quartos
🚿 [N] casas de banho
📐 [Área]m²
[emoji] [Feature principal]
[emoji] [Feature secundário]
📍 [Proximidade chave]

### 3. Email automático (GHL trigger)
Assunto: O teu [Apartamento/Moradia/etc.] [Tipologia] [prep+Localidade] está à tua espera 🏡

Olá, {{contact.first_name}}! 👋
Obrigado pelo seu interesse neste [Apartamento/Moradia/etc.] [Tipologia] em [Localidade] 🏡.
Trata-se de um [apartamento/moradia/terreno/etc.] com [Área]m², [N quartos], [N WC], [listar features principais em frase corrida].
Vou entrar em contacto consigo o mais rapidamente possível para lhe enviar todos os detalhes e, se desejar, agendar a sua visita.
Muito obrigado,
{{nome do consultor}} 📞 {{telefone}}
