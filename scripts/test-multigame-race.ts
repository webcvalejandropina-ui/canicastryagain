import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
async function run(){
 const worker=process.argv[2]==='worker';
 const folder=worker?'':mkdtempSync(join(tmpdir(),'canicas-cap-race-'));
 if(!worker)process.env.SQLITE_PATH=join(folder,'race.db');
 const {sqlite}=await import('../src/backend/shared/infrastructure/db/sqlite');
 const {Game}=await import('../src/backend/game/domain/Game');
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const repo=new SqliteGameRepository();
 const table=(id:string,code:string)=>Game.create({id,code,numRows:3,creator:{id:'race-owner',name:'Race'}});
 if(worker){
  process.once('message',async()=>{try{await repo.save(table('raced-'+process.argv[3],'RACE0'+process.argv[3]));process.send?.('created');}catch(error){process.send?.((error as {code?:string}).code??'unexpected');}finally{sqlite.close();process.disconnect?.();}});
  process.send?.('ready');return;
 }
 try{
  for(let i=0;i<4;i++)await repo.save(table('existing-'+i,'BASE0'+i));
  const children=Array.from({length:4},(_,i)=>fork(fileURLToPath(import.meta.url),['worker',String(i)],{execArgv:['--import','tsx'],env:{...process.env},stdio:['ignore','inherit','inherit','ipc']}));
  const results=children.map(child=>new Promise<string>((resolve,reject)=>{child.on('error',reject);child.on('message',message=>{if(message!=='ready')resolve(String(message));});child.once('exit',code=>{if(code)reject(new Error('Worker failed: '+code));});}));
  await Promise.all(children.map(child=>new Promise<void>((resolve,reject)=>{child.on('message',message=>{if(message==='ready')resolve();});child.on('error',reject);})));children.forEach(child=>child.send('save'));
  const outcomes=await Promise.all(results);
  assert.equal(outcomes.filter(r=>r==='created').length,1);
  assert.equal(outcomes.filter(r=>r==='ACTIVE_GAME_LIMIT').length,3);
  assert.equal((sqlite.prepare('SELECT count(*) n FROM games').get()as{n:number}).n,5);
  await Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise<void>(resolve=>child.once('exit',()=>resolve()))));
  console.log('OK: four independent Node workers race for the fifth slot; exactly one commits, three are rejected and SQLite contains exactly five games');
 }finally{sqlite.close();rmSync(folder,{recursive:true,force:true});}
}
void run().catch(error=>{console.error(error);process.exitCode=1});
