import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const handlers={},stores=new Map();let offline=false,revision=1,broken=false,networkCalls=0;
const origin='https://canicas.test',key=input=>new URL(typeof input==='string'?input:input.url,origin).href;
const network=async input=>{
 networkCalls++;if(offline)throw Error('Offline');const path=new URL(key(input)).pathname;
 if(path.includes('noiseFilter'))throw Error('SVG fragment is not a downloadable asset');
 if(broken&&path.endsWith('game-2.js'))throw Error('Chunk unavailable');
 if(path==='/pwa-assets.json')return Response.json({assets:['/_next/static/three-dynamic.js','/worlds/summer.webp']});
 if(path==='/demo')return new Response(`<html><link href="/_next/static/theme.css"/><script src="/_next/static/game-${revision}.js"></script><img src="/worlds/normal.webp"/>Practice ${revision}</html>`);
 if(path.endsWith('.css'))return new Response('@font-face{src:url("/fonts/archivo.ttf")}body{background:url("/glass/crystal.webp");filter:url(%23noiseFilter)}');
 if(path==='/offline.html')return new Response('OFFLINE PAGE');
 return new Response('ASSET '+path);
};
const caches={
 async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
 async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
  async match(input,options){const wanted=key(input);if(options?.ignoreSearch){const found=[...store.entries()].find(([url])=>url.split('?')[0]===wanted.split('?')[0]);return found?.[1].clone();}return store.get(wanted)?.clone();},async put(input,response){store.set(key(input),response.clone());},async delete(input){return store.delete(key(input));},
  async keys(){return [...store.keys()].map(url=>new Request(url));},
  async addAll(urls){const responses=await Promise.all(urls.map(async url=>[url,await network(url)]));for(const [url,response] of responses){assert.ok(response.ok);store.set(key(url),response.clone());}}
 };}
};
let skipped=0,claimed=0;
const self={location:{origin},addEventListener(name,handler){handlers[name]=handler;},async skipWaiting(){skipped++;},clients:{async claim(){claimed++;}}};
vm.runInNewContext(await readFile('public/sw.js','utf8'),{self,caches,fetch:network,crypto:webcrypto,TextEncoder,Response,URL,Uint8Array,Error,Set});
const event=async(name,data={})=>{let task;handlers[name]({...data,waitUntil(promise){task=promise;}});await task;};
const request=async(path,{method='GET',navigate=false,crossOrigin=false}={})=>{let response;handlers.fetch({request:{method,mode:navigate?'navigate':'cors',url:(crossOrigin?'https://other.test':origin)+path},respondWith(value){response=value;}});return response===undefined?undefined:await response;};
await caches.open('unrelated-cache');await event('install');await event('activate');assert.equal(skipped,1);assert.equal(claimed,1);
assert.equal(await request('/api/games/private?token=secret'),undefined);assert.equal(await request('/api/games',{method:'POST'}),undefined);assert.equal(await request('/icons/a.png',{crossOrigin:true}),undefined);
const calls=networkCalls;offline=true;
assert.match(await (await request('/demo',{navigate:true})).text(),/Practice 1/);
assert.equal(await (await request('/?inv=private-token',{navigate:true})).text(),'OFFLINE PAGE');
assert.match(await (await request('/_next/static/three-dynamic.js')).text(),/ASSET/);
assert.match(await (await request('/fonts/archivo.ttf')).text(),/ASSET/);assert.match(await (await request('/glass/crystal.webp')).text(),/ASSET/);
assert.match(await (await request('/_next/static/game-1.js?v=build')).text(),/ASSET/);
assert.equal(networkCalls,calls+2,'Only navigations try the network; precached assets work offline');
let offlineReady=false;await event('message',{data:{type:'REFRESH_PRACTICE'},source:{postMessage(value){offlineReady=value.type==='PRACTICE_READY';}}});assert.equal(offlineReady,true,'Installed practice reports ready even while offline');
offline=false;revision=2;broken=true;await event('message',{data:{type:'REFRESH_PRACTICE'}});offline=true;
assert.match(await (await request('/demo',{navigate:true})).text(),/Practice 1/,'A partial update does not replace the working offline app');
offline=false;broken=false;await event('message',{data:{type:'REFRESH_PRACTICE'}});offline=true;
assert.match(await (await request('/demo',{navigate:true})).text(),/Practice 2/);assert.ok(stores.has('unrelated-cache'));
assert.equal([...stores.keys()].filter(name=>name.startsWith('canicas-pwa-core-')).length,1,'Old public snapshots cleaned after atomic update');
offline=false;for(let i=0;i<70;i++)await request('/worlds/image-'+i+'.webp');
assert.equal(stores.get('canicas-pwa-assets-v1').size,64,'Bounded artwork cache');
for(const store of stores.values())for(const url of store.keys())assert.ok(!url.includes('/api/')&&!url.includes('private-token'),'Never store API, identity or private invitation navigations');
const manifest=await readFile('src/app/manifest.ts','utf8');assert.match(manifest,/standalone/);
for(const file of ['192','512','180','maskable-512']){const bytes=await readFile(`public/icons/icon-${file}.png`);assert.equal(bytes.readUInt32BE(0),0x89504e47);}
console.log('OK: installable metadata/icons; offline practice/chunks/fonts/crystal; API and private links never cached or queued; atomic public updates; bounded artwork cache; unrelated caches preserved.');
