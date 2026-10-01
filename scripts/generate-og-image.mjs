/**
 * Rasterise the Open Graph preview image.
 *
 * `public/og-image.svg` is the editable source of truth for link previews.
 * WhatsApp, Facebook, X/Twitter, LinkedIn and iMessage all refuse to render SVG
 * previews, so the SVG must be baked down to a raster image before it can be
 * referenced from `og:image`. This script does that and is re-run whenever the
 * SVG changes.
 *
 *   node scripts/generate-og-image.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public', 'og-image.svg');
const target = resolve(root, 'public', 'og-image.png');

const svg = await readFile(source);

await sharp(svg, { density: 384 })
  .resize(1200, 630)
  .png({ compressionLevel: 9, quality: 90 })
  .toFile(target);

const { size } = await sharp(target).metadata().then((m) => ({ size: m.width * m.height }));
console.log(`Wrote ${target} (1200x630, ${size === 1200 * 630 ? 'dimensions OK' : 'DIMENSION MISMATCH'})`);