// Development-only resizing/encoding. Color variants are code-native CSS, not new bitmaps.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CANICAS_SHARP_MODULE||'sharp');
const assets={};
for(const [name,source] of [['crystal','marble-linea.png'],['eventCrystal','marble-source.png']]){
 const body=await sharp(`artwork/glass/${source}`).resize(160,160).webp({quality:82,effort:6}).toBuffer();
 const hash=createHash('sha256').update(body).digest('hex').slice(0,12);
 const path=`/glass/crystal.${hash}.webp`;
 await writeFile(`public${path}`,body);assets[name]=path;
 console.log(name,body.length,'bytes');
}
await writeFile('src/features/appearance/glassAssets.json',JSON.stringify(assets,null,2)+'\n');
await writeFile('src/app/glass-assets.css',`:root{--glass-base-image:url("${assets.crystal}");--glass-event-image:url("${assets.eventCrystal}");--glass-image:var(--glass-base-image)}\n`);
