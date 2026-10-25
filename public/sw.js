/* Cache public practice and immutable artwork only. Never cache or queue API traffic. */
const PREFIX='canicas-pwa-core-v1-',ASSETS='canicas-pwa-assets-v1';
let refreshing;
const assetPath=path=>path.startsWith('/_next/static/')||/^\/(fonts|glass|worlds|icons)\//.test(path);
async function core() {
 const names=(await caches.keys()).filter(n=>n.startsWith(PREFIX)).reverse();
 for(const name of names){const cache=await caches.open(name);if(await cache.match('/demo'))return cache;}
 return null;
}
function refreshPractice() {
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const response=await fetch('/demo',{cache:'no-store'});if(!response.ok)throw Error('Practice unavailable');
  const html=await response.clone().text();
  const assetsResponse=await fetch('/pwa-assets.json',{cache:'no-store'});
  if(!assetsResponse.ok)throw Error('Offline assets unavailable');
  const declared=(await assetsResponse.json()).assets;
  const extras=Array.isArray(declared)?declared.filter(path=>typeof path==='string'&&assetPath(path)&&!path.startsWith('//')):[];
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html+JSON.stringify(extras))))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16);
  const name=PREFIX+hash,cache=await caches.open(name);
  if(!(await cache.match('/demo'))){
   const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),self.location.origin)).filter(u=>u.origin===self.location.origin&&assetPath(u.pathname)).map(u=>u.pathname);
   const downloads=[...new Set(['/offline.html','/icons/icon-192.png',...urls,...extras])];
   for(let i=0;i<downloads.length;i+=8)await cache.addAll(downloads.slice(i,i+8));
   const styles=urls.filter(path=>path.endsWith('.css'));
   for(const path of styles){
    const css=await (await cache.match(path))?.text();
    const resources=[...(css||'').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>new URL(m[1],self.location.origin+path)).filter(u=>u.origin===self.location.origin&&(/^\/(fonts|glass|worlds|icons)\//.test(u.pathname)||u.pathname.startsWith('/_next/static/media/'))).map(u=>u.pathname);
    if(resources.length)await cache.addAll([...new Set(resources)]);
   }
   await cache.put('/demo',response);
  }
  await Promise.all((await caches.keys()).filter(n=>n.startsWith(PREFIX)&&n!==name).map(n=>caches.delete(n)));
 })().finally(()=>{refreshing=null;});
 return refreshing;
}
self.addEventListener('install',event=>event.waitUntil(refreshPractice().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='REFRESH_PRACTICE')event.waitUntil((async()=>{const ready=()=>event.source?.postMessage({type:'PRACTICE_READY'});if(await core())ready();try{await refreshPractice();ready();}catch{/* Retain the complete installed practice when offline. */}})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{
   const cache=await core();
   const offline=await cache?.match(url.pathname==='/demo'?'/demo':'/offline.html');
   return offline||new Response('Sin conexión. Vuelve a intentarlo cuando haya red.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }));return;
 }
 if(!assetPath(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await core(),runtime=await caches.open(ASSETS);
  const hit=await cache?.match(request,{ignoreSearch:true})||await runtime.match(request,{ignoreSearch:true});if(hit)return hit;
  const response=await fetch(request);
  if(response.ok){await runtime.put(request,response.clone());const keys=await runtime.keys();for(const key of keys.slice(0,Math.max(0,keys.length-64)))await runtime.delete(key);}
  return response;
 })());
});
