// Development-only resizing/encoding. Color variants are code-native CSS, not new bitmaps.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CANICAS_SHARP_MODULE||'sharp');
const body=await sharp('artwork/glass/marble-source.png').resize(160,160).webp({quality:82,effort:6}).toBuffer();
const hash=createHash('sha256').update(body).digest('hex').slice(0,12);
const path=`/glass/crystal.${hash}.webp`;
await writeFile(`public${path}`,body);
await writeFile('src/features/appearance/glassAssets.json',JSON.stringify({crystal:path},null,2)+'\n');
await writeFile('src/app/glass-assets.css',`:root{--glass-image:url("${path}")}\n`);
console.log('Shared optical glass:',body.length,'bytes');
