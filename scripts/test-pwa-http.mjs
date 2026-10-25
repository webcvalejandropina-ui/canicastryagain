import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const origin=process.env.PWA_QA_ORIGIN||'http://127.0.0.1:13001';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Disposable local QA server only');
const worker=await fetch(origin+'/sw.js');assert.equal(worker.status,200);assert.match(worker.headers.get('cache-control'),/no-cache/);
const code=await worker.text(),manifest=await (await fetch(origin+'/manifest.webmanifest')).json();
assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
for(const icon of manifest.icons){const response=await fetch(origin+icon.src);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.readUInt32BE(0),0x89504e47);assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));}
const root=await (await fetch(origin)).text();assert.match(root,/manifest.webmanifest/);assert.ok(!root.includes('__canicas_sw_cleanup__'));
const stores=new Map(),handlers={};let offline=false,downloaded=0;
const key=input=>new URL(typeof input==='string'?input:input.url,origin).href;
const network=async(input,options)=>{if(offline)throw Error('Offline');const url=key(input),response=await fetch(url,options);assert.equal(response.status,200,`Failed offline resource: ${url}`);downloaded++;return response;};
const caches={async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
 async match(input,options){const wanted=key(input),found=options?.ignoreSearch?[...store.entries()].find(([url])=>url.split('?')[0]===wanted.split('?')[0])?.[1]:store.get(wanted);return found?.clone();},
 async put(input,response){store.set(key(input),response.clone());},async delete(input){return store.delete(key(input));},async keys(){return [...store.keys()].map(url=>new Request(url));},
 async addAll(urls){const responses=await Promise.all(urls.map(async url=>[url,await network(url)]));for(const [url,response] of responses)store.set(key(url),response.clone());}
 };}};
const self={location:{origin},addEventListener(name,handler){handlers[name]=handler;},async skipWaiting(){},clients:{async claim(){}}};
vm.runInNewContext(code,{self,caches,fetch:network,crypto:webcrypto,TextEncoder,Response,URL,Uint8Array,Error,Set});
let task;handlers.install({waitUntil(promise){task=promise;}});await task;
let ready=false;handlers.message({data:{type:'REFRESH_PRACTICE'},source:{postMessage(value){ready=value.type==='PRACTICE_READY';}},waitUntil(promise){task=promise;}});await task;assert.equal(ready,true);
const core=[...stores.values()][0],paths=[...core.keys()].map(url=>new URL(url).pathname);
assert.ok(paths.some(path=>path.endsWith('.js')));assert.ok(paths.some(path=>path.endsWith('.css')));assert.ok(paths.some(path=>path.startsWith('/fonts/')));assert.ok(paths.some(path=>path.startsWith('/glass/')));
offline=true;
async function offlineRequest(path,mode='cors'){let response;handlers.fetch({request:{url:origin+path,method:'GET',mode},respondWith(promise){response=promise;}});return await response;}
assert.match(await (await offlineRequest('/demo','navigate')).text(),/Demo jugable/);
assert.match(await (await offlineRequest('/?inv=private','navigate')).text(),/Practicar sin conexión/);
for(const path of paths.filter(path=>path.startsWith('/_next/static/')||path.startsWith('/fonts/')||path.startsWith('/glass/'))){const response=await offlineRequest(path);assert.equal(response.status,200);await response.arrayBuffer();}
assert.equal(await offlineRequest('/api/games/private'),undefined);
console.log(`OK: production manifest/PNG icons/worker headers; ${downloaded} real resources downloaded, all practice JS/CSS/fonts/crystal served with the network disabled in the worker harness; private/API requests bypass cache.`);
