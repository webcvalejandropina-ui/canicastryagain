import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {birthdayPhase,encodeBirthday,decodeBirthday} from '../src/shared/birthday';
import {playerProfileSchema} from '../src/features/session/profile';
import {runMigrations} from '../src/backend/shared/infrastructure/db/migrations';
import {resolveManagedScene} from '../src/features/appearance/events/calendar';
import {DEFAULT_EVENTS} from '../src/features/appearance/events/catalog';
const birthday={month:10,day:31};
for(const year of [2024,2025,2026,2027,2028,2030,2100]) {
  for(const [day,phase] of [['10-29',null],['10-30','before'],['10-31','today'],['11-01','after'],['11-02',null]] as const)assert.equal(birthdayPhase(birthday,new Date(`${year}-${day}T12:00:00Z`)),phase);
}
assert.equal(birthdayPhase({month:1,day:1},new Date('2026-12-31T12:00:00Z')),'before');
assert.equal(birthdayPhase({month:12,day:31},new Date('2027-01-01T12:00:00Z')),'after');
assert.equal(birthdayPhase(birthday,new Date('2026-10-29T23:00:00Z')),'before','Madrid calendar, not UTC date');
assert.equal(birthdayPhase(birthday,new Date('2026-11-01T23:00:00Z')),null);
for(const [date,phase] of [['2028-02-28','before'],['2028-02-29','today'],['2028-03-01','after'],['2027-02-27','before'],['2027-02-28','today'],['2027-03-01','after']] as const)assert.equal(birthdayPhase({month:2,day:29},new Date(date+'T12:00:00Z')),phase);
assert.equal(birthdayPhase({month:3,day:29},new Date('2026-03-28T23:30:00Z')),'today','DST boundary');
for(const value of [{month:2,day:30},{month:4,day:31},{month:13,day:1},{month:1,day:0},{month:1.5,day:1}])assert(!playerProfileSchema.safeParse({birthday:value}).success);
assert(!playerProfileSchema.safeParse({birthday:{month:10,day:31,year:1990}}).success,'No birth year retained');
assert.equal(decodeBirthday('02-30'),null);assert.equal(decodeBirthday('2026-10-31'),null);
assert.deepEqual(decodeBirthday(encodeBirthday(birthday)),birthday);
const date=new Date('2026-10-30T12:00:00Z');
for(const registered of [false,true]) {
 const scene=resolveManagedScene({season:'auto',birthday},DEFAULT_EVENTS,null,date,null,{registered,birthday});
 assert.equal(scene.world,registered?'birthday':'halloween');
}
assert.equal(resolveManagedScene({season:'auto',birthday},DEFAULT_EVENTS,null,date).world,'halloween');
assert.equal(resolveManagedScene({season:'auto'},DEFAULT_EVENTS,null,date,null,{registered:true,birthday:null}).world,'halloween');
assert.equal(resolveManagedScene({season:'none'},DEFAULT_EVENTS,null,date,null,{registered:true,birthday}).world,'none');
assert.equal(resolveManagedScene({season:'auto',backgroundPolicy:'original'},DEFAULT_EVENTS,null,date,null,{registered:true,birthday}).world,'none');
const db=new Database(':memory:');runMigrations(db);db.prepare('INSERT INTO players(id,alias,password_hash,created_at) VALUES(?,?,?,?)').run('b','Birthday','hash',new Date().toISOString());
for(const value of ['02-30','04-31','13-01','00-01','1-01','01-00',"10-31'; DROP TABLE players;--"])assert.throws(()=>db.prepare('UPDATE players SET birthday=? WHERE id=?').run(value,'b'));
db.prepare('UPDATE players SET birthday=? WHERE id=?').run('02-29','b');runMigrations(db);assert.equal((db.prepare('SELECT birthday FROM players WHERE id=?').get('b') as {birthday:string}).birthday,'02-29');db.close();
console.log('Birthday: registered accounts only, three days, account priority, opt-out, Madrid/DST/year/leap boundaries, validation and migration OK');
