import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { SCENERIES, DEFAULT_SCENERY, isScenery } from '../src/features/appearance/sceneries';
import assets from '../src/features/appearance/sceneryAssets.json';
import { DEFAULT_EVENTS } from '../src/features/appearance/events/catalog';
import { activeOn, easterSunday, resolveManagedScene, type ManagedEvent } from '../src/features/appearance/events/calendar';
import { parseAppearance } from '../src/features/appearance/appearance';
import { AppearanceStore, eventSchema } from '../src/backend/appearance/AppearanceStore';
import { BackgroundStore } from '../src/backend/appearance/BackgroundStore';
const date=(s:string)=>new Date(s+'T12:00:00Z');
const resolve=(d:string,p:Parameters<typeof resolveManagedScene>[0]={season:'auto'})=>resolveManagedScene(p,DEFAULT_EVENTS,null,date(d));
assert.equal(DEFAULT_SCENERY,'gibraltar');
assert.equal(resolve('2026-02-10').scenery,'gibraltar');
for(const scenery of ['cadiz','generic','tarifa','gibraltar'] as const) {
  assert.equal(resolve('2026-02-10',{season:'auto',scenery}).scenery,scenery);
  assert.equal(resolve('2026-10-31',{season:'auto',scenery,backgroundPolicy:'original'}).scenery,scenery);
  assert.equal(resolve('2026-10-31',{season:'none',scenery}).scenery,scenery);
  assert.equal(resolve('2026-10-31',{season:'auto',scenery}).world,'halloween');
  assert.equal(resolve('2026-10-31',{season:'auto',scenery}).scenery,undefined);
  assert.equal(parseAppearance(JSON.stringify({scenery})).scenery,scenery);
}
assert.equal(parseAppearance('{"scenery":"__proto__"}').scenery,undefined);
assert(!isScenery('__proto__'));assert(!isScenery('https://external.invalid'));
assert.equal(resolve('2026-07-10').scenery,'tarifa');
assert.equal(resolve('2026-12-25').world,'christmas');
assert.equal(resolve('2026-12-25').scenery,undefined);
assert.equal(resolve('2026-10-31',{season:'auto',birthday:{day:31,month:10}}).world,'halloween','Legacy local birthday is not an account profile');
const holy=DEFAULT_EVENTS.find(e=>e.id==='holy-week')!;
for(const [year,day] of [[2024,'03-31'],[2025,'04-20'],[2026,'04-05'],[2027,'03-28'],[2028,'04-16'],[2030,'04-21']] as const) {
  assert.equal(easterSunday(year).toISOString().slice(0,10),`${year}-${day}`);
  const easter=easterSunday(year);
  for(let offset=-9;offset<=2;offset++) {
    const d=new Date(easter.getTime()+offset*86400000);
    assert.equal(activeOn(holy,d),offset>=-7&&offset<=0,`${year} day ${offset}`);
  }
}
assert.equal(resolve('2027-03-21').scenery,'holy-week');
assert.equal(resolve('2027-03-29').scenery,'gibraltar');
assert(activeOn(holy,new Date('2026-04-04T22:30:00Z')));
assert(!activeOn(holy,new Date('2026-04-05T22:30:00Z')));
for(const patch of [{start:'NaN'},{start:'-61'},{end:'61'},{start:'1',end:'0'}])assert(!eventSchema.safeParse({...holy,...patch}).success);
const club={world:'inherit' as const,scenery:'cadiz' as const};
const personal={...holy,recurrence:'always' as const,scenery:'generic' as const};
assert.equal(resolveManagedScene({season:'auto'},DEFAULT_EVENTS,personal,date('2026-10-31'),club).scenery,'generic');
assert.equal(resolveManagedScene({season:'auto',backgroundPolicy:'calendar'},DEFAULT_EVENTS,personal,date('2026-10-31'),club).world,'halloween');
assert.equal(resolveManagedScene({season:'auto',backgroundPolicy:'calendar'},DEFAULT_EVENTS,personal,date('2026-10-31'),club).scenery,undefined);
assert.equal(resolveManagedScene({season:'auto'},DEFAULT_EVENTS,null,date('2026-10-31'),club).scenery,'cadiz');
assert.equal(resolveManagedScene({season:'auto'},DEFAULT_EVENTS,null,date('2026-12-25'),{world:'inherit'}).scenery,undefined);
assert.equal(resolveManagedScene({season:'auto'},DEFAULT_EVENTS,null,date('2026-07-10'),{world:'inherit'}).scenery,'tarifa');
assert.equal(resolveManagedScene({season:'auto',birthday:{month:10,day:31}},DEFAULT_EVENTS,personal,date('2026-10-31'),club,{registered:true,birthday:{month:10,day:31}}).world,'birthday');
const db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec("CREATE TABLE players(id TEXT PRIMARY KEY,is_admin INTEGER);INSERT INTO players VALUES('admin',1),('user',0)");
const store=new AppearanceStore(db);store.saveEvent('admin',{...holy,title:'Mi celebración',scenery:'tarifa'});
store.assign('admin','user',personal);assert.equal(store.personal('user')?.scenery,'generic');
const backgrounds=new BackgroundStore(db);backgrounds.setDefault('admin',club);assert.equal(backgrounds.defaultBackground()?.scenery,'cadiz');
assert.throws(()=>backgrounds.setDefault('user',club));assert.throws(()=>store.saveEvent('admin',{...holy,scenery:'../../file'}));
new AppearanceStore(db);assert.equal(store.events().find(e=>e.id===holy.id)?.title,'Mi celebración','Never overwrite administrator changes on boot');
db.close();
let small=0,large=0;
for(const id of Object.keys(SCENERIES) as (keyof typeof SCENERIES)[]) {
  for(const size of ['small','large'] as const) {
    const url=assets[id][size],body=readFileSync('public'+url);
    assert(url.includes('.'+createHash('sha256').update(body).digest('hex').slice(0,10)+'.'));
    assert.equal(body.toString('ascii',8,12),'WEBP');
    assert(body.length<(size==='small'?60:180)*1024);
    if(size==='small')small=Math.max(small,body.length);else large=Math.max(large,body.length);
  }
}
assert.notEqual(assets.gibraltar.large,assets.cadiz.large);
console.log(`Sceneries: priorities, opt-out, user/admin persistence, Easter across years, Madrid boundaries and static image budgets OK (${small}/${large} B max)`);
