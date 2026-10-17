// Turns raw captures (screenshots/raw/*.png) into the WebP files the site uses:
//   assets/img/<name>.webp      max 1600px wide
//   assets/img/<name>-800.webp  800px wide, for srcset
// Quality starts at 82 and steps down only if a file would exceed 250 KB.
//
//   node scripts/optimize.mjs                 every raw capture
//   node scripts/optimize.mjs name1 name2     only those
// A crop can be applied per file through CROPS (in raw-pixel coordinates).
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const RAW = 'screenshots/raw';
const OUT = 'assets/img';
const MAX_BYTES = 250 * 1024;
const SIZES = [{ width: 1600, suffix: '' }, { width: 800, suffix: '-800' }];

// name -> { left, top, width, height } applied before resizing.
export const CROPS = {};

mkdirSync(OUT, { recursive: true });

async function encode(input, width, file) {
  for (let q = 82; q >= 60; q -= 4) {
    const buf = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toBuffer();
    if (buf.length <= MAX_BYTES || q <= 62) {
      await sharp(buf).toFile(file);
      const { width: w, height: h } = await sharp(buf).metadata();
      return { q, kb: Math.round(buf.length / 1024), w, h };
    }
  }
}

const only = process.argv.slice(2);
const files = readdirSync(RAW).filter((f) => f.endsWith('.png') && (!only.length || only.includes(basename(f, '.png'))));
for (const f of files) {
  const name = basename(f, '.png');
  let img = sharp(`${RAW}/${f}`);
  if (CROPS[name]) img = img.extract(CROPS[name]);
  const input = await img.png().toBuffer();
  for (const { width, suffix } of SIZES) {
    const out = `${OUT}/${name}${suffix}.webp`;
    const r = await encode(input, width, out);
    const flag = statSync(out).size > MAX_BYTES ? '  !! over 250 KB' : '';
    console.log(`${out.padEnd(44)} ${r.w}x${r.h}  q${r.q}  ${r.kb} KB${flag}`);
  }
}
