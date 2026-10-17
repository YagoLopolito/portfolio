// Builds the social preview (assets/img/og.jpg, 1200x630) and the "YL" favicons from the site's own
// fonts, colours and screenshots, so they stay in sync with the page.
//   npm run serve, then: node scripts/og.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

// Rendered on the local static server (npm run serve) so the screenshots load over http.
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const img = (name) => `${BASE}/assets/img/${name}`;

const og = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  body{margin:0;width:1200px;height:630px;background:#0c0e15;color:#eceef6;overflow:hidden;position:relative;font-family:"Chakra Petch",sans-serif}
  .text{position:absolute;left:72px;top:150px;width:520px}
  .label{font:500 18px/1 "IBM Plex Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#9aa1b8}
  h1{font-size:104px;line-height:.95;margin:28px 0 24px;font-weight:700}
  h1 span{display:block;color:#7d8cff}
  p{font-size:34px;font-weight:600;margin:0}
  .tile{position:absolute;border-radius:12px;overflow:hidden;border:1px solid #2a3044;box-shadow:0 24px 60px rgba(0,0,0,.55)}
  .tile img{display:block;width:100%;height:100%;object-fit:cover;object-position:top left}
  .a{left:610px;top:70px;width:520px;aspect-ratio:1600/899}
  .b{left:690px;top:300px;width:470px;aspect-ratio:16/10}
</style></head><body>
  <div class="text"><div class="label">Portfolio · Buenos Aires</div><h1>Yago <span>Lopolito</span></h1><p>QA Engineer &amp; Game Developer</p></div>
  <div class="tile a"><img src="${img('predio-match-800.webp')}"></div>
  <div class="tile b"><img src="${img('platinoob-library-800.webp')}"></div>
</body></html>`;

// Monogram on the site's accent colour, in a system sans (same look in the SVG and the PNGs).
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7d8cff"/><text x="32" y="44" text-anchor="middle" font-family="Chakra Petch, Arial, sans-serif" font-weight="700" font-size="32" fill="#0c0e15">YL</text></svg>`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(BASE);
await page.setContent(og, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot();
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile('assets/img/og.jpg');

// Render the monogram with the real font, then rasterise the PNG sizes from that.
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&display=swap"><style>body{margin:0;background:transparent}svg{display:block;width:512px;height:512px}</style></head><body>${icon}</body></html>`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const big = await page.screenshot({ omitBackground: true });
await browser.close();

await sharp(big).resize(32).png().toFile('favicon-32.png');
await sharp(big).resize(180).png().toFile('apple-touch-icon.png');
// The SVG favicon keeps the system-font fallback; it is tiny and scales cleanly in tabs.
writeFileSync('favicon.svg', icon);
console.log('og.jpg', Math.round(readFileSync('assets/img/og.jpg').length / 1024), 'KB; favicon.svg, favicon-32.png, apple-touch-icon.png');
