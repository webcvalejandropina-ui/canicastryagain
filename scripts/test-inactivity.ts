import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
process.env.SQLITE_PATH=':memory:';
async function main(){
 const {sqlite}=await import('../src/backend/shared/infrastructure/db/sqlite');
 const {Game}=await import('../src/backend/game/domain/Game');
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const {GAME_INACTIVITY_MS,isGameInactive}=await import('../src/backend/game/domain/GameInactivity');
 const {readGameRevision}=await import('../src/backend/game/infrastructure/GameRevision');
 const {GET:get}=await import('../src/app/api/games/[gameId]/route');
 const {GET:events}=await import('../src/app/api/games/[gameId]/events/route');
 const {POST:move}=await import('../src/app/api/games/[gameId]/move/route');
 const {POST:dice}=await import('../src/app/api/games/[gameId]/dice/route');
 const {POST:join}=await import('../src/app/api/games/join/route');
 const {gameStreams}=await import('../src/backend/game/infrastructure/GameStreamRegistry');
 const repo=new SqliteGameRepository();
 const token='a'.repeat(64),cookie=`canicas_session=${token}`;
 sqlite.prepare('INSERT INTO players(id,alias,password_hash) VALUES(?,?,?)').run('a','A','fixture');
 sqlite.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'a',Date.now()+60000);

 const create=async(id:string)=>{const g=Game.create({id,code:id.toUpperCase().padEnd(6,'X'),numRows:7,creator:{id:'a',name:'A'}});g.join({id:'b',name:'B'});await repo.save(g);return g;};
 const realNow=Date.now,now=realNow();Date.now=()=>now;
 try{
  assert.equal(isGameInactive('playing',new Date(now-GAME_INACTIVITY_MS+1).toISOString(),now),false);
  assert.equal(isGameInactive('playing',new Date(now-GAME_INACTIVITY_MS).toISOString(),now),true);
  assert.equal(isGameInactive('finished',new Date(0).toISOString(),now),false);
  assert.equal(isGameInactive('waiting',new Date(0).toISOString(),now),false);
  const g=await create('expire');const context={params:Promise.resolve({gameId:g.id})};
  const path=`http://localhost/api/games/${g.id}?playerId=a`;
  const stream=await events(new Request(path,{headers:{cookie}}),context);assert.equal(stream.status,200);
  const reader=stream.body!.getReader();await reader.read();
  const old=new Date(now-GAME_INACTIVITY_MS).toISOString();
  sqlite.prepare('UPDATE games SET updated_at=? WHERE id=?').run(old,g.id);
  assert.equal(readGameRevision(g.id,'a'),null);
  for(const url of [path,path+'&revision='+g.revision]){const response=await get(new Request(url,{headers:{cookie}}),context);assert.equal(response.status,410);assert.equal((await response.json()).code,'GAME_EXPIRED');}
  const req=(url:string,body:unknown)=>new Request(url,{method:'POST',headers:{cookie,'content-type':'application/json',origin:'http://localhost'},body:JSON.stringify(body)});
  assert.equal((await move(req(path,{playerId:'a',rowIndex:6,startIndex:0,removeCount:1}),context)).status,410);
  assert.equal((await dice(req(path,{playerId:'a'}),context)).status,410);
  assert.equal((await join(req('http://localhost/api/games/join',{playerId:'a',playerName:'A',gameCode:g.code}))).status,410);
  assert.equal((await events(new Request(path,{headers:{cookie}}),context)).status,410);
  gameStreams.tick();
  let body='';for(;;){const result=await reader.read();if(result.done)break;body+=new TextDecoder().decode(result.value);}
  assert.match(body,/GAME_EXPIRED/);assert.equal(gameStreams.activeConnections,0,'Both transport and registry release expired connections');
  assert.equal((sqlite.prepare('SELECT updated_at FROM games WHERE id=?').get(g.id) as {updated_at:string}).updated_at,old,'Reads do not renew or delete the table');
  assert.equal((sqlite.prepare('SELECT count(*) AS n FROM ranking_stats').get() as {n:number}).n,0,'Expiry awards no victory or loss');
  const privateGame=Game.create({id:'private',code:'PRIVAT',numRows:7,privateInvitation:true,creator:{id:'a',name:'A'}});privateGame.join({id:'b',name:'B'},privateGame.toPrimitives().privateInviteToken!);await repo.save(privateGame);sqlite.prepare('UPDATE games SET updated_at=? WHERE id=?').run(old,privateGame.id);
  await assert.rejects(()=>repo.getByInviteToken(privateGame.toPrimitives().privateInviteToken!),(error:any)=>error.code==='GAME_EXPIRED');
  await assert.rejects(()=>repo.getByCode('PRIVAT'),(error:any)=>error.code==='GAME_EXPIRED');
  const race=await create('race');race.makeMove({playerId:'a',rowIndex:6,startIndex:0,removeCount:1});
  sqlite.prepare('UPDATE games SET updated_at=? WHERE id=?').run(old,race.id);
  await assert.rejects(()=>repo.save(race),(error:any)=>error.code==='GAME_EXPIRED','A command cannot revive a table that expires before commit');
  const active=await create('active');const recent=new Date(now-GAME_INACTIVITY_MS+1).toISOString();sqlite.prepare('UPDATE games SET updated_at=? WHERE id=?').run(recent,active.id);
  const playable=(await repo.getById(active.id))!;playable.makeMove({playerId:'a',rowIndex:6,startIndex:0,removeCount:1});await repo.save(playable);
  assert.ok(Date.parse((await repo.getById(active.id))!.toPrimitives().updatedAt)>now-1000,'A valid action renews the 24-hour period');
  sqlite.prepare("UPDATE games SET status='finished',updated_at=? WHERE id=?").run(old,active.id);assert.equal((await repo.getById(active.id))!.status,'finished');
  console.log('OK: exact 24h boundary, real actions renew, reads do not; GET/conditional GET/move/dice/join/SSE reject expired tables; streams close; stale writes cannot revive; history and rankings preserved.');
 }finally{Date.now=realNow;}
}
void main();
