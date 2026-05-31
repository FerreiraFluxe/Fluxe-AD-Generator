'use strict';
const fse = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { takeScreenshot } = require('./screenshot');

const os = require('os');
const TEMP_DIR = path.join(os.tmpdir(), 'fluxe-ad-temp');
const OUT_DIR = path.join(os.tmpdir(), 'fluxe-ad-out');

// Smart crop + colour enhancement before embedding
// isExterior: stronger saturation/brightness for sky/greenery
async function photoToBase64(imgPath, width, height, isExterior = false) {
  const saturation = isExterior ? 1.35 : 1.2;
  const brightness = isExterior ? 1.04 : 1.01;

  const buf = await sharp(imgPath)
    .resize(width, height, { fit: 'cover', position: 'attention' }) // entropy smart-crop
    .modulate({ saturation, brightness })
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 93 })
    .toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

// Smart typology label: only prepend "Apartamento" for bare T-codes
function formatTypology(raw) {
  if (!raw) return '';
  const t = raw.trim();
  const hasPropertyType = /moradia|vivenda|apartamento|terreno|loja|armazém|armazem|garagem|studio|loft|quintal|quinta/i.test(t);
  if (/^T\d/i.test(t) && !hasPropertyType) return 'Apartamento ' + t.toUpperCase();
  return t;
}

function buildHtml({ exteriorB64, ext2B64, int1B64, int2B64, data, amiNumber }) {
  const { typology, location, price, area, bedrooms, bathrooms } = data;
  const displayTypology = formatTypology(typology);
  const dualTop = !!ext2B64;

  // Pixel map (1080px total):
  //   Photo zone:    0 – 500px  (500px)
  //   White zone:  500 – 740px  (240px)
  //   Interior:    740 – 1080px (340px)
  //
  // Badge: top=470, h=60 → bottom=530 → straddles 500px boundary
  // Content: starts at 544px (14px below badge bottom)
  // Content ends: ~684px
  // Pills: top=694 → 10px gap from specs → center=726 → straddles 740px boundary

  const topPhotoHtml = dualTop ? `
    <div class="photo-clip-left"><img src="${exteriorB64}" alt="" /></div>
    <div class="photo-clip-right"><img src="${ext2B64}" alt="" /></div>` : `
    <div class="photo-clip-single"><img src="${exteriorB64}" alt="" /></div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=block" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1080px; overflow: hidden;
  background: #fff;
  font-family: 'Inter', 'Liberation Sans', Arial, Helvetica, sans-serif;
}
.layout { position: relative; width: 1080px; height: 1080px; }

.photo-clip-single {
  position: absolute; top: 0; left: 0;
  width: 1080px; height: 500px; overflow: hidden;
}
.photo-clip-left {
  position: absolute; top: 0; left: 0;
  width: 540px; height: 500px; overflow: hidden;
}
.photo-clip-right {
  position: absolute; top: 0; left: 540px;
  width: 540px; height: 500px; overflow: hidden;
}
.photo-clip-single img,
.photo-clip-left img,
.photo-clip-right img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  display: block;
}


/* Badge: top=404, h=60px → bottom=464 → fully INSIDE photo (36px above 500px boundary) */
.badge {
  position: absolute; top: 404px; left: 50%; transform: translateX(-50%);
  background: #E8232A; color: #fff;
  font-size: 36px; font-weight: 900; letter-spacing: 1px; line-height: 1;
  padding: 12px 52px; border-radius: 60px;
  white-space: nowrap;
  box-shadow: 0 6px 28px rgba(0,0,0,0.44);
  z-index: 20;
}

/* White zone: 500–710px = 210px — less white, more interior photo space */
.mid-zone {
  position: absolute; top: 500px; left: 0;
  width: 1080px; height: 210px; background: #fff;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  padding: 12px 32px 0;
  gap: 6px;
}
.venda-line {
  font-size: 24px; color: #555; font-weight: 400; line-height: 1;
}
.venda-line strong { color: #111; font-weight: 800; }
.typology-line {
  font-size: 82px; font-weight: 900; color: #111;
  letter-spacing: -2px; line-height: 1;
  white-space: nowrap;
}
.specs-row {
  display: flex; gap: 28px; align-items: center;
  font-size: 27px; font-weight: 700; color: #333; line-height: 1;
}
.spec-item { display: flex; align-items: center; gap: 9px; }
.spec-icon {
  width: 27px; height: 27px; flex-shrink: 0;
  fill: none; stroke: #333; stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round;
  display: block;
}

/* Interior photos: 710–1080px = 370px */
.bottom-zone {
  position: absolute; top: 710px; left: 0;
  width: 1080px; height: 370px; display: flex;
}
.interior { width: 540px; height: 370px; overflow: hidden; }
.interior img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  display: block;
}

/* Pills: top=668, h=64px → center=700 → straddles 710px boundary
   11px gap from specs end (657px). Pills overlap: red sits on yellow edge */
.pills-row {
  position: absolute; top: 668px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 0; align-items: center;
  z-index: 20;
}
.pill-price {
  background: #FFD600; color: #111;
  font-size: 38px; font-weight: 900; line-height: 1;
  padding: 13px 44px; border-radius: 60px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.pill-cta {
  background: #E8232A; color: #fff;
  font-size: 38px; font-weight: 900; line-height: 1;
  padding: 13px 44px; border-radius: 60px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  margin-left: -20px; z-index: 1;
}
</style>
</head>
<body>
<div class="layout">

  ${topPhotoHtml}
  <div class="badge">OPORTUNIDADE!</div>

  <div class="mid-zone">
    <div class="venda-line"><strong>Venda</strong> – ${location}</div>
    <div class="typology-line">${displayTypology}</div>
    <div class="specs-row">
      ${area ? `<div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>${area}</span>
      </div>` : ''}
      ${bedrooms ? `<div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
        <span>${bedrooms} Quartos</span>
      </div>` : ''}
      <div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M5 12V7a3 3 0 0 1 6 0v1"/><rect x="3" y="12" width="18" height="5" rx="2"/><path d="M4 17v2M20 17v2"/></svg>
        <span>${bathrooms} WC</span>
      </div>
    </div>
  </div>

  <div class="bottom-zone">
    <div class="interior"><img src="${int1B64}" alt="" /></div>
    <div class="interior"><img src="${int2B64}" alt="" /></div>
  </div>

  <div class="pills-row">
    <div class="pill-price">${price}</div>
    <div class="pill-cta">SAIBA MAIS</div>
  </div>

</div>
</body>
</html>`;
}

function buildHtmlStory_UNUSED({ exteriorB64, ext2B64, int1B64, int2B64, data }) {
  // Kept for reference only — story is now generated via Sharp compositing in generateStory()
  const { typology, location, area, bedrooms, bathrooms } = data;
  const displayTypology = formatTypology(typology);
  const dualTop = !!ext2B64;

  const topPhotoHtml = dualTop ? `
    <div class="photo-clip-left"><img src="${exteriorB64}" alt="" /></div>
    <div class="photo-clip-right"><img src="${ext2B64}" alt="" /></div>` : `
    <div class="photo-clip-single"><img src="${exteriorB64}" alt="" /></div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1920px; overflow: hidden;
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
}
.layout { position: relative; width: 1080px; height: 1920px; }

/* Photo zone: 880px tall */
.photo-zone {
  position: absolute; top: 0; left: 0;
  width: 1080px; height: 880px; overflow: hidden;
}
.photo-clip-single {
  position: absolute; top: 0; left: 0;
  width: 1080px; height: 880px; overflow: hidden;
}
.photo-clip-left {
  position: absolute; top: 0; left: 0;
  width: 540px; height: 880px; overflow: hidden;
}
.photo-clip-right {
  position: absolute; top: 0; left: 540px;
  width: 540px; height: 880px; overflow: hidden;
}
.photo-clip-single img,
.photo-clip-left img,
.photo-clip-right img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  transform: scale(1.12); transform-origin: center;
  display: block;
}
/* Tilt-shift: strong blur covering ~45% top + ~40% bottom — only center band sharp */
.blur-top {
  position: absolute; top: 0; left: 0; right: 0; height: 400px;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  -webkit-mask-image: linear-gradient(to bottom, black 30%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 30%, transparent 100%);
  pointer-events: none; z-index: 5;
}
.blur-bottom {
  position: absolute; bottom: 0; left: 0; right: 0; height: 380px;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  -webkit-mask-image: linear-gradient(to top, black 30%, transparent 100%);
  mask-image: linear-gradient(to top, black 30%, transparent 100%);
  pointer-events: none; z-index: 5;
}

/* Badge straddles 880px boundary */
.badge {
  position: absolute; top: 820px; left: 50%; transform: translateX(-50%);
  background: #E8232A; color: #fff;
  font-size: 36px; font-weight: 900; letter-spacing: 1px; line-height: 1;
  padding: 12px 52px; border-radius: 60px;
  white-space: nowrap;
  box-shadow: 0 6px 28px rgba(0,0,0,0.44);
  z-index: 20;
}

/* White zone: 880–1340px = 460px — all content in flex flow, vertically centered */
.mid-zone {
  position: absolute; top: 880px; left: 0;
  width: 1080px; height: 460px; background: #fff;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 20px 32px;
  gap: 14px;
}
.venda-line {
  font-size: 24px; color: #555; font-weight: 400; line-height: 1;
}
.venda-line strong { color: #111; font-weight: 800; }
.typology-line {
  font-size: 82px; font-weight: 900; color: #111;
  letter-spacing: -2px; line-height: 1;
  white-space: nowrap;
}
.specs-row {
  display: flex; gap: 28px; align-items: center;
  font-size: 27px; font-weight: 700; color: #333; line-height: 1;
}
.spec-item { display: flex; align-items: center; gap: 9px; }
.spec-icon {
  width: 27px; height: 27px; flex-shrink: 0;
  fill: none; stroke: #333; stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round;
  display: block;
}
/* SAIBA MAIS pill — part of flex flow, no absolute positioning */
.pill-cta {
  background: #E8232A; color: #fff;
  font-size: 40px; font-weight: 900; line-height: 1;
  padding: 16px 80px; border-radius: 60px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* Interior photos: 1340–1920px = 580px, each 540×580 */
.bottom-zone {
  position: absolute; top: 1340px; left: 0;
  width: 1080px; height: 580px; display: flex;
}
.interior { width: 540px; height: 580px; overflow: hidden; }
.interior img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  display: block;
}
</style>
</head>
<body>
<div class="layout">

  <div class="photo-zone">
    ${topPhotoHtml}
    <div class="blur-top"></div>
    <div class="blur-bottom"></div>
  </div>
  <div class="badge">OPORTUNIDADE!</div>

  <div class="mid-zone">
    <div class="venda-line"><strong>Venda</strong> – ${location}</div>
    <div class="typology-line">${displayTypology}</div>
    <div class="specs-row">
      ${area ? `<div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>${area}</span>
      </div>` : ''}
      ${bedrooms ? `<div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
        <span>${bedrooms} Quartos</span>
      </div>` : ''}
      <div class="spec-item">
        <svg class="spec-icon" viewBox="0 0 24 24"><path d="M5 12V7a3 3 0 0 1 6 0v1"/><rect x="3" y="12" width="18" height="5" rx="2"/><path d="M4 17v2M20 17v2"/></svg>
        <span>${bathrooms} WC</span>
      </div>
    </div>
    <div class="pill-cta">SAIBA MAIS</div>
  </div>

  <div class="bottom-zone">
    <div class="interior"><img src="${int1B64}" alt="" /></div>
    <div class="interior"><img src="${int2B64}" alt="" /></div>
  </div>

</div>
</body>
</html>`;
}

async function generateStory({ photos, outputName, outDir }) {
  const targetDir = outDir || OUT_DIR;
  await fse.ensureDir(targetDir);

  // Story = full-bleed blurred background (exterior) + 1080×1080 square overlaid at center
  // Layout (1080×1920):
  //   Background: exterior stretched to 1080×1920, heavily blurred
  //   Square: 1080×1080 composited at top=420 → y 420–1500
  //   Top strip (0–420): blurred exterior — no text, clear for Meta top safe zone (250px)
  //   Bottom strip (1500–1920): blurred exterior — no text, clear for Meta bottom safe zone (340px)

  const squarePngPath = path.join(targetDir, `${outputName}.png`);
  const storyPath = path.join(targetDir, `${outputName}-story.png`);

  const bgBuf = await sharp(photos.exterior)
    .resize(1080, 1920, { fit: 'cover', position: 'attention' })
    .modulate({ saturation: 1.2, brightness: 1.02 })
    .blur(28)
    .png()
    .toBuffer();

  await sharp(bgBuf)
    .composite([
      { input: squarePngPath, top: 420, left: 0 },
    ])
    .png()
    .toFile(storyPath);

  return storyPath;
}

async function generateAd({ photos, data, outputName, amiNumber, outDir }) {
  const targetDir = outDir || OUT_DIR;
  await fse.ensureDir(TEMP_DIR);
  await fse.ensureDir(targetDir);

  const dualTop = !!photos.ext2;

  const tasks = [
    photoToBase64(photos.exterior, dualTop ? 540 : 1080, 500, true),
    photoToBase64(photos.int1, 540, 370, false),
    photoToBase64(photos.int2, 540, 370, false),
  ];
  if (dualTop) tasks.push(photoToBase64(photos.ext2, 540, 500, true));

  const [exteriorB64, int1B64, int2B64, ext2B64] = await Promise.all(tasks);

  const html = buildHtml({ exteriorB64, ext2B64: ext2B64 || null, int1B64, int2B64, data, amiNumber });
  const htmlPath = path.join(TEMP_DIR, `${outputName}.html`);
  const pngPath = path.join(targetDir, `${outputName}.png`);

  await fse.writeFile(htmlPath, html, 'utf8');
  await takeScreenshot(htmlPath, pngPath);

  const storyPath = await generateStory({ photos, outputName, outDir: targetDir });
  return { square: pngPath, story: storyPath };
}

async function generateAllVariants({ photos, data, amiNumber, outDir }) {
  const targetDir = outDir || OUT_DIR;
  await fse.ensureDir(targetDir);

  const variants = ['variant-a', 'variant-b', 'variant-c'];
  const results = [];

  for (const suffix of variants) {
    await fse.ensureDir(TEMP_DIR);
    const [exteriorB64, int1B64, int2B64] = await Promise.all([
      photoToBase64(photos.exterior, 1080, 500, true),
      photoToBase64(photos.int1, 540, 310, false),
      photoToBase64(photos.int2, 540, 310, false),
    ]);
    const html = buildHtml({ exteriorB64, ext2B64: null, int1B64, int2B64, data, amiNumber });
    const htmlPath = path.join(TEMP_DIR, `${suffix}.html`);
    const pngPath = path.join(targetDir, `${suffix}.png`);
    await fse.writeFile(htmlPath, html, 'utf8');
    await takeScreenshot(htmlPath, pngPath);
    results.push({ variant: suffix, pngPath });
    console.log(`Generated: ${pngPath}`);
  }
  return results;
}

if (require.main === module) {
  const testPhotos = {
    exterior: process.argv[2] || path.join(ROOT, 'outputs', 'test', 'placeholders', 'exterior.png'),
    int1: process.argv[3] || path.join(ROOT, 'outputs', 'test', 'placeholders', 'int1.png'),
    int2: process.argv[4] || path.join(ROOT, 'outputs', 'test', 'placeholders', 'int2.png'),
  };
  const testData = { typology: 'T2', location: 'Almada', price: '210.000€', area: '75m²', bedrooms: '2', bathrooms: '1' };
  generateAllVariants({ photos: testPhotos, data: testData, amiNumber: '8451', outDir: path.join(ROOT, 'outputs', 'test') })
    .then(res => console.log('Done:', res.map(r => r.pngPath)))
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { generateAd, generateStory, generateAllVariants };
