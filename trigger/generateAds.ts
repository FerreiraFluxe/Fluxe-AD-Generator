import { task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COPY_SYSTEM_PROMPT = `És um copywriter especialista em imobiliário português. Geras copy pronto a publicar no Meta Ads — específico, conciso, sem frases genéricas.

REGRAS ABSOLUTAS:
1. NUNCA uses travessão "—". Usa vírgula ou ponto e vírgula.
2. PT-PT obrigatório. Contrações correctas: "numa", "num", "nesta", "neste", "desta", "deste". NUNCA "em uma", "em um", "nessa", "nesse".
3. Tutear: "agenda a tua visita", "clica no link", "não deixes escapar", "a tua família".
4. TIPO COMPLETO: "Moradia T3", "Apartamento T2". NUNCA só "T3" ou "T2".
5. CAPITALIZAÇÃO de localidades: maiúscula em cada palavra principal.
   CERTO: "Charneca da Caparica", "Costa da Caparica", "Pinhal do General", "Cova da Piedade"
   ERRADO: "charneca da caparica", "cova da piedade"
6. PREPOSIÇÃO contraída antes da localidade (testa: "moro __ [localidade]"):
   - "da/das" → "na": "na Charneca da Caparica", "na Costa da Caparica", "na Cova da Piedade"
   - "do/dos" → "no": "no Pinhal do General", "no Restelo"
   - sem artigo → "em": "em Setúbal", "em Almada", "em Fernão Ferro"
7. ZERO frases genéricas. Proibido: "espaço acolhedor", "zona em crescimento", "ideal para famílias", "ambiente familiar". Usa factos concretos do imóvel.
8. Os bullets ✅ devem ter dados específicos: distâncias, nomes de lugares, características reais.

COPY BODY — formato exacto (meio texto, nem muito longo nem muito curto):
🏠 [Tipo] [Tipologia] [prep+Localidade] — [Preço]
[1 frase de abertura que destaca o USP principal, específico e concreto]

📍 O que inclui:
🛏️ [N] quartos[, X suites se aplicável]
🚿 [N] casa(s) de banho
📐 [X]m²[, + garagem/terraço/jardim/piscina se existir]
[emoji + feature diferenciadora concreta do imóvel]

Porque vale a pena visitar?

✅ [Facto concreto de localização, ex: "Vista mar em todos os pisos" ou "A 5 min da Praia de Fernão Ferro"]
✅ [Acesso/transporte específico, ex: "A 10 min da Costa da Caparica e 20 min de Lisboa pela A33"]
✅ [Zona ou valorização com dado real, ex: "Condomínio exclusivo de 4 moradias, sem vizinhos colados"]
✅ [Detalhe único do imóvel, ex: "2 cozinhas, AC em toda a casa, suite com terraço privado"]

🔑 Agenda já a tua visita! [Tipo] [prep+Localidade] com estas características não ficam disponíveis por muito tempo.
👉 Clica no link, preenche o formulário e marca a tua visita.

TÍTULOS (5 variações — curtos, máx 40 caracteres, sem frases, prontos para Meta):
🏡 [Tipo] [Tipologia] [prep+Localidade] - [Preço]
🌊 [Tipo] [Tipologia] [prep+Localidade] - [Feature destaque curta]
📐 [Tipo] [Tipologia] [prep+Localidade] - [X]m²
🏠 [Tipo] [Tipologia] [prep+Localidade] - [N] Quartos
💰 [Tipo] [Tipologia] [prep+Localidade] - [Feature secundária curta]
EXEMPLOS: "🏡 Moradia T4 na Charneca da Caparica - 615.000€" | "🌊 Moradia T4 na Charneca da Caparica - Vista Mar"

FORMULÁRIO META (título + bullets, cada um numa linha, pronto a colar):
[Tipo] [Tipologia] – [Localidade]
🛏️ [N] quartos
🚿 [N] casas de banho
📐 [X]m²
[emoji + feature principal do imóvel]
[emoji + feature secundária]
📍 [Proximidade mais relevante com dado concreto]

EMAIL GHL (automação GoHighLevel — pronto a usar):
Assunto: A tua [Tipo] [Tipologia] [prep+Localidade] está à tua espera 🏡
Corpo:
Olá, {{contact.first_name}}! 👋

Obrigado pelo interesse nest[a/e] [Tipo] [Tipologia] [prep+Localidade].

[2 frases específicas sobre o imóvel: área, feature principal, localização concreta]

Para agendares a tua visita, responde a este email ou liga directamente ao teu consultor.

Um abraço,
{{contact.assigned_to}}
📞 {{contact.phone}}

Responde APENAS com JSON válido, sem markdown, sem texto extra:
{
  "body": "copy body completo com emojis e quebras de linha \\n",
  "titles": ["título 1", "título 2", "título 3", "título 4", "título 5"],
  "form_title": "título do formulário (primeira linha)",
  "form_description": "bullets separados por \\n",
  "email_subject": "assunto do email",
  "email_body": "corpo do email com \\n para quebras de linha"
}`;

interface CopyBlock {
  body: string;
  titles: string[];
  form_title: string;
  form_description: string;
  email_subject: string;
  email_body: string;
}

async function generateCopy(property: {
  typology: string;
  location: string;
  price: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  features?: string;
}): Promise<CopyBlock> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY não configurada');

  const userPrompt = `Gera copy completo para este imóvel:
Tipo + Tipologia: ${property.typology}
Localidade: ${property.location}
Preço: ${property.price}
Área: ${property.area} m²
Quartos: ${property.bedrooms}
WC: ${property.bathrooms}
${property.features ? `Destaques: ${property.features}` : ''}

Devolve apenas o JSON pedido, sem markdown, sem explicações.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: COPY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Groq devolveu resposta vazia');

  return JSON.parse(content) as CopyBlock;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

interface PhotoScore {
  path: string;
  brightness: number;
  saturation: number;
  ratio: number;
  exteriorScore: number;
}

async function classifyPhotos(photoPaths: string[]): Promise<{
  exterior: string;
  ext2?: string;
  int1: string;
  int2: string;
  int3?: string;
  int4?: string;
}> {
  const sharp = require('sharp');
  const scores: PhotoScore[] = [];

  for (const p of photoPaths) {
    try {
      const meta = await sharp(p).metadata();
      const ratio = (meta.width || 1) / (meta.height || 1);

      // Sample colours from a 50×50 thumbnail
      const { data } = await sharp(p).resize(50, 50).raw().toBuffer({ resolveWithObject: true });
      let brightness = 0, blueGreenBias = 0;
      const px = data.length / 3;
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i+1], b = data[i+2];
        brightness += r * 0.299 + g * 0.587 + b * 0.114;
        if (b > r * 1.1 || g > r * 1.05) blueGreenBias++;
      }
      brightness /= px;
      blueGreenBias /= px;

      // Wide + bright + blue-green tones = exterior/pool/sky
      const exteriorScore = ratio * 0.4 + (brightness / 255) * 0.3 + blueGreenBias * 0.3;
      scores.push({ path: p, brightness, saturation: 0, ratio, exteriorScore });
    } catch {
      scores.push({ path: p, brightness: 128, saturation: 0, ratio: 1.33, exteriorScore: 0 });
    }
  }

  // Sort by exterior likelihood: top 2 = exteriors, rest = interiors sorted by brightness (brighter = better interior)
  const byExterior = [...scores].sort((a, b) => b.exteriorScore - a.exteriorScore);
  const byBrightness = [...scores].sort((a, b) => b.brightness - a.brightness);

  const ext = byExterior[0]?.path || photoPaths[0];
  const ext2 = byExterior[1]?.path;

  // Best interiors = brightest photos that aren't already used as exteriors
  const usedAsExt = new Set([ext, ext2]);
  const interiors = byBrightness.filter(s => !usedAsExt.has(s.path)).map(s => s.path);

  return {
    exterior: ext,
    ext2: ext2,
    int1: interiors[0] || photoPaths[0],
    int2: interiors[1] || photoPaths[1] || photoPaths[0],
    int3: interiors[2],
    int4: interiors[3],
  };
}

export const generateAdsTask = task({
  id: 'generate-ads',
  maxDuration: 300,
  machine: { preset: 'large-1x' },
  run: async (payload: { jobId: string }) => {
    const { jobId } = payload;

    // Mark processing
    await supabaseAdmin.from('jobs').update({ status: 'processing' }).eq('id', jobId);

    // Load job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs').select('*').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('Job not found: ' + jobId);

    const tmpDir = path.join(os.tmpdir(), jobId);
    const outDir = path.join(tmpDir, 'outputs');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    try {
      // Download input photos from Supabase Storage
      const photoPaths: string[] = [];
      for (const storagePath of (job.input_paths as string[])) {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('inputs').createSignedUrl(storagePath, 300);
        if (!signedUrl?.signedUrl) continue;
        const localPath = path.join(tmpDir, path.basename(storagePath));
        await downloadFile(signedUrl.signedUrl, localPath);
        photoPaths.push(localPath);
      }

      // Scrape listing if URL provided
      let property = job.property;
      if (!property && job.listing_url) {
        const { scrapeListing } = require('../scripts/scrape-listing');
        const scraped = await scrapeListing(job.listing_url);
        property = {
          typology: scraped.typology || 'Apartamento',
          location: scraped.location || '',
          price: scraped.price || '',
          area: scraped.area || '',
          bedrooms: scraped.bedrooms || '',
          bathrooms: scraped.bathrooms || '',
        };
        await supabaseAdmin.from('jobs').update({ property }).eq('id', jobId);
      }

      if (!property) throw new Error('No property data available');

      // Classify photos
      const classified = await classifyPhotos(photoPaths);

      // Build 5 job configs: mix single-top and dual-top
      const data = {
        typology: property.typology,
        location: property.location,
        price: property.price,
        area: property.area,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      };

      const { generateAd } = require('../scripts/generate-ad');

      const { exterior: ext, ext2, int1, int2, int3, int4 } = classified;
      // Fallbacks so every slot always has a photo
      const i3 = int3 || int1;
      const i4 = int4 || int2;
      const e2 = ext2 || int1;

      const jobs = [
        // 1 — SINGLE TOP: melhor exterior | int1 | int2
        { photos: { exterior: ext,  int1: int1, int2: int2 }, outputName: 'ad-01' },
        // 2 — DUAL TOP:   exterior + ext2 | int1 | int2
        { photos: { exterior: ext,  ext2: e2,   int1: int1, int2: int2 }, outputName: 'ad-02' },
        // 3 — SINGLE TOP: int1 como hero  | int2 | int3
        { photos: { exterior: int1, int1: int2,  int2: i3  }, outputName: 'ad-03' },
        // 4 — DUAL TOP:   int1 + int2     | ext  | int3
        { photos: { exterior: int1, ext2: int2,  int1: ext, int2: i3   }, outputName: 'ad-04' },
        // 5 — DUAL TOP:   exterior + int1 | int3 | int4
        { photos: { exterior: ext,  ext2: int1,  int1: i3,  int2: i4   }, outputName: 'ad-05' },
      ];

      // Generate ads sequentially — parallel crashes (5 Chrome × 300MB = OOM)
      const generatedPaths: string[] = [];
      for (const adJob of jobs) {
        const r = await generateAd({ ...adJob, data, amiNumber: null, outDir });
        generatedPaths.push(r.square, r.story);
      }

      // Upload all outputs in parallel
      const outputUrls = (await Promise.all(
        generatedPaths.map(async (filePath: string) => {
          const fileName = path.basename(filePath);
          const storagePath = `${jobId}/${fileName}`;
          const fileBuffer = fs.readFileSync(filePath);
          await supabaseAdmin.storage.from('outputs').upload(storagePath, fileBuffer, {
            contentType: 'image/png',
            upsert: true,
          });
          const { data: signed } = await supabaseAdmin.storage
            .from('outputs').createSignedUrl(storagePath, 7 * 24 * 60 * 60);
          return signed?.signedUrl ?? null;
        })
      )).filter(Boolean) as string[];

      // Generate copy via Groq
      let copy: CopyBlock | null = null;
      try {
        copy = await generateCopy({
          typology: data.typology,
          location: data.location,
          price: data.price,
          area: data.area,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
        });
      } catch (copyErr: any) {
        console.error('Copy generation failed (non-fatal):', copyErr.message);
      }

      // Create Meta campaign structure if client has an ad account
      let metaResult: Record<string, unknown> | null = null;
      const adAccountId = job.ad_account_id as string | null;
      if (adAccountId) {
        try {
          const { createMetaCampaign } = require('../scripts/create-meta-campaign');
          // Pass local file paths (still on disk here) so Meta gets bytes, not a URL
          const squarePaths = generatedPaths.filter((p: string) => !p.includes('-story'));
          metaResult = await createMetaCampaign({
            adAccountId,
            property: data,
            copy,
            squareImagePaths: squarePaths,
          });
          console.log('Meta campaign created:', metaResult);
        } catch (metaErr: any) {
          console.error('Meta campaign creation failed (non-fatal):', metaErr.message);
          metaResult = { error: metaErr.message };
        }
      }

      await supabaseAdmin.from('jobs').update({
        status: 'done',
        output_urls: outputUrls,
        ...(copy ? { copy } : {}),
        ...(metaResult ? { meta_result: metaResult } : {}),
      }).eq('id', jobId);

    } catch (err: any) {
      await supabaseAdmin.from('jobs').update({ status: 'error', error: err.message }).eq('id', jobId);
      throw err;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
});
