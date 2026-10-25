/** Offline encoding only. Sharp is a development tool, never part of the server path. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require(process.env.CANICAS_SHARP_MODULE || 'sharp');
const out = resolve('public/worlds');
await mkdir(out, { recursive: true });
const assets = {};
for (const id of ['none', 'christmas', 'summer', 'birthday', 'halloween']) {
  assets[id] = {};
  for (const width of [640, 1280]) {
    const image = await sharp(resolve('artwork/worlds', `${id === "none" ? "cadiz" : id}.png`))
      .resize({ width, withoutEnlargement: true }).webp({ quality: 68, effort: 6 }).toBuffer();
    const hash = createHash('sha256').update(image).digest('hex').slice(0, 10);
    const name = `${id}-${width}.${hash}.webp`;
    await writeFile(join(out, name), image);
    assets[id][width === 640 ? 'small' : 'large'] = `/worlds/${name}`;
    console.log(`${name}: ${image.length} B`);
  }
}
await writeFile(resolve('src/features/appearance/illustrationAssets.json'), JSON.stringify(assets, null, 2) + '\n');
