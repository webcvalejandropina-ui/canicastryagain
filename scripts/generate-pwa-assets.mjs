import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),dist=process.env.NEXT_DIST_DIR?.trim()||'.next';
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(file));else result.push(file);}return result;}
const statics=(await files(path.join(root,dist,'static'))).filter(file=>/\.(js|css|woff2?|ttf)$/.test(file)).map(file=>'/_next/static/'+path.relative(path.join(root,dist,'static'),file).split(path.sep).join('/'));
const artwork=[];for(const folder of ['fonts','icons'])for(const file of await files(path.join(root,'public',folder)))if(/\.(webp|svg|png|woff2?|ttf)$/.test(file))artwork.push('/'+path.relative(path.join(root,'public'),file).split(path.sep).join('/'));
// Precache the active catalog, not superseded hashes left for older installed builds.
const sceneSource=await readFile(path.join(root,'src/features/appearance/sceneAssets.ts'),'utf8');
const scene=JSON.parse(sceneSource.slice(sceneSource.indexOf('=')+1,sceneSource.lastIndexOf(' as const;')));
const collect=value=>typeof value==='string'&&/^\/(worlds|glass)\/[\w.-]+\.(webp|svg)$/.test(value)?[value]:value&&typeof value==='object'?Object.values(value).flatMap(collect):[];
for(const manifest of [scene,JSON.parse(await readFile(path.join(root,'src/features/appearance/sceneryAssets.json'),'utf8')),JSON.parse(await readFile(path.join(root,'src/features/appearance/glassAssets.json'),'utf8'))])artwork.push(...collect(manifest));
const assets=[...new Set([...statics,...artwork])].sort();
await writeFile(path.join(root,'public','pwa-assets.json'),JSON.stringify({assets})+'\n');
console.log(`PWA: ${assets.length} public build assets prepared, including optional 3D chunks.`);
