/** Offline only: new places never add image encoding to a game request. */
import { SCENERIES } from '../src/features/appearance/sceneries.ts';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CANICAS_SHARP_MODULE||'sharp');
const assets={};
for(const [id,place] of Object.entries(SCENERIES)) {
  assets[id]={};
  for(const width of [640,1280]) {
    const data=await sharp(await readFile(`artwork/worlds/${place.source}`)).resize({width,withoutEnlargement:true}).webp({quality:65,effort:6}).toBuffer();
    const hash=createHash('sha256').update(data).digest('hex').slice(0,10);
    const name=`${id}-${width}.${hash}.webp`;
    await writeFile(`public/worlds/${name}`,data);
    assets[id][width===640?'small':'large']=`/worlds/${name}`;
    console.log(name, data.length);
  }
}
await writeFile('src/features/appearance/sceneryAssets.json',JSON.stringify(assets,null,2)+'\n');
