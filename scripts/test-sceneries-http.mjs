// Deliberately requires an isolated QA server with fixture accounts.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.SCENERY_QA_ORIGIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''))throw Error('Use an isolated QA server');
const login=async alias=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({alias,password:'PruebaLocal2026'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]};
const admin=await login('EventosQA'),user=await login('JugadorQA');
const post=(path,body,cookie=admin,origin=base)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(body)});
const calendarResponse=await fetch(base+'/api/appearance');assert.match(calendarResponse.headers.get('cache-control'),/public/);const calendar=await calendarResponse.json();
const holy=calendar.events.find(e=>e.id==='holy-week');assert(holy);assert.equal(holy.recurrence,'easter');
assert.equal((await post('/api/admin/appearance',{action:'save',event:{...holy,scenery:'tarifa'}})).status,200);
assert.equal((await post('/api/admin/appearance',{action:'save',event:{...holy,scenery:'__proto__'}})).status,400);
assert.equal((await post('/api/admin/appearance',{action:'save',event:holy},user)).status,403);
assert.equal((await post('/api/admin/appearance',{action:'save',event:holy},admin,'https://foreign.invalid')).status,403);
assert.equal((await post('/api/admin/appearance',{action:'assign',playerId:'calendar-qa-player',event:{...holy,scenery:'generic',recurrence:'always'}})).status,200);
const privateResponse=await fetch(base+'/api/appearance/me',{headers:{Cookie:user}});assert.match(privateResponse.headers.get('cache-control'),/no-store/);assert.equal((await privateResponse.json()).scene.scenery,'generic');
assert.equal((await (await fetch(base+'/api/appearance/me')).json()).scene,null);
for(const scenery of ['gibraltar','cadiz','tarifa','generic','holy-week']) {
  assert.equal((await post('/api/admin/backgrounds',{club:{world:'inherit',scenery}})).status,200);
  const response=await fetch(base+'/api/appearance');const body=await response.json();assert.equal(body.club.scenery,scenery);
  assert.equal((await fetch(base+'/api/appearance',{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
}
const assets=JSON.parse(await readFile('src/features/appearance/sceneryAssets.json','utf8'));
for(const asset of Object.values(assets))for(const url of Object.values(asset)) {
  const response=await fetch(base+url);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/immutable/);assert.match(response.headers.get('content-type'),/image\/webp/);
}
assert.equal((await post('/api/admin/backgrounds',{club:{world:'inherit',scenery:'https://foreign.invalid'}})).status,400);
await post('/api/admin/backgrounds',{club:null});await post('/api/admin/appearance',{action:'assign',playerId:'calendar-qa-player',event:null});await post('/api/admin/appearance',{action:'save',event:holy});
const report={ok:true,checks:['Easter migration','admin permissions','CSRF','invalid scenery rejected','private assignment','no public user leak','all five presets through backend','ETag/304','immutable WebP delivery']};
await mkdir('entregables/escenarios-y-conectividad',{recursive:true});await writeFile('entregables/escenarios-y-conectividad/http.json',JSON.stringify(report,null,2)+'\n');console.log(report);
