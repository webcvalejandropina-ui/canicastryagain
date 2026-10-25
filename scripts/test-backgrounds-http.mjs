// QA only: requires the isolated CristalQA / CristalUsuarioQA fixture accounts.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const origin=process.env.BACKGROUND_QA_ORIGIN;if(!origin?.startsWith('http://127.0.0.1:'))throw new Error('Use the temporary QA server');
const login=async(alias)=>{const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({alias,password:'PruebaLocal2026'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
const admin=await login('CristalQA');const user=await login('CristalUsuarioQA');
const assets=JSON.parse(await readFile('src/features/appearance/illustrationAssets.json','utf8'));const image=await readFile('public'+assets.none.small);
const upload=(cookie,body)=>fetch(origin+'/api/admin/backgrounds',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'image/webp','X-Background-Title':encodeURIComponent('Pradera de prueba')},body});
assert.equal((await upload(user,image)).status,403);assert.equal((await upload(admin,Buffer.from('<svg/>'))).status,400);assert.equal((await upload(admin,Buffer.alloc(750001))).status,413);
const result=await upload(admin,image);assert.equal(result.status,201);const {asset}=await result.json();
const url=origin+'/api/backgrounds/'+asset.id;const served=await fetch(url);assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/webp');assert.match(served.headers.get('cache-control'),/immutable/);assert.equal((await served.arrayBuffer()).byteLength,image.length);
assert.equal((await fetch(url,{headers:{'If-None-Match':`"${asset.id}"`}})).status,304);
const setClub=club=>fetch(origin+'/api/admin/backgrounds',{method:'POST',headers:{Cookie:admin,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({club})});
assert.equal((await setClub({world:'none',backgroundId:asset.id,weather:'rain'})).status,200);
const config=await (await fetch(origin+'/api/appearance',{cache:'no-store'})).json();assert.equal(config.club.backgroundId,asset.id);assert(config.events.some(e=>e.id==='feria-sevilla-2027'));
const event={...config.events.find(e=>e.id==='feria-sevilla-2027'),recurrence:'always',backgroundId:asset.id};
const assigned=await fetch(origin+'/api/admin/appearance',{method:'POST',headers:{Cookie:admin,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'assign',playerId:'glass-user',event})});assert.equal(assigned.status,200);
const personal=await (await fetch(origin+'/api/appearance/me',{headers:{Cookie:user}})).json();assert.equal(personal.scene.backgroundId,asset.id);
assert.equal((await (await fetch(origin+'/api/appearance/me')).json()).scene,null);
console.log('HTTP backgrounds: upload, authentication, format/size checks, custom assignment, fairs, immutable delivery and 304 OK');
