import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
process.env.SQLITE_PATH=':memory:';
async function main() {
  const {Game}=await import('../src/backend/game/domain/Game');
  const {DICE_POWER_NAMES}=await import('../src/backend/game/domain/DicePowers');
  const {resolveAncientShot}=await import('../src/backend/game/domain/AncientShot');
  const {sqlite}=await import('../src/backend/shared/infrastructure/db/sqlite');
  const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
  const {CreateGameUseCase}=await import('../src/backend/game/application/CreateGameUseCase');
  const {POST:create}=await import('../src/app/api/games/route');
  const {GAME_INACTIVITY_MS}=await import('../src/backend/game/domain/GameInactivity');
  const repo=new SqliteGameRepository(),creator={id:'rows-host',name:'Filas QA'};
  for(const count of [1,7,50,100]) {
    const game=Game.create({id:'pure',code:'PURE01',numRows:count,creator});
    const state=game.toPrimitives();assert.equal(state.rows.length,count);
    assert.equal(state.rows.at(-1)!.length,count);assert.equal(state.rows.flat().length,count*(count+1)/2);
  }
  const useCase=new CreateGameUseCase(repo);
  for(const numRows of [0,-1,101,1.5,NaN,Infinity]) {
    assert.throws(()=>Game.create({id:'invalid',code:'BAD001',numRows,creator}));
    await assert.rejects(()=>useCase.execute({playerId:creator.id,playerName:creator.name,numRows}));
  }
  const secret='c'.repeat(64),cookie=`canicas_session=${secret}`;
  sqlite.prepare('INSERT INTO players(id,alias,password_hash) VALUES(?,?,?)').run(creator.id,creator.name,'fixture');
  sqlite.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(secret).digest('hex'),creator.id,Date.now()+60000);
  const request=(numRows:number)=>new Request('http://localhost/api/games',{method:'POST',headers:{origin:'http://localhost',cookie,'content-type':'application/json'},body:JSON.stringify({playerId:creator.id,playerName:creator.name,numRows})});
  for(const invalid of [0,101,2.5])assert.equal((await create(request(invalid))).status,400);
  const response=await create(request(100));assert.equal(response.status,201);
  const view=(await response.json()).game;assert.equal(view.numRows,100);assert.equal(view.rows.flat().length,5050);
  const game=(await repo.getById(view.gameId))!;game.join({id:'rows-rival',name:'Rival QA'});await repo.save(game);
  for(let row=0;row<100;row++) {
    const before=game.toPrimitives();
    game.makeMove({playerId:before.currentTurn===1?creator.id:'rows-rival',rowIndex:row,startIndex:0,removeCount:row+1});
    await repo.save(game);
  }
  const finished=(await repo.getById(game.id))!.toPrimitives();
  assert.equal(finished.status,'finished');assert.equal(finished.winner,1);assert.equal(finished.moveHistory.length,100);assert.equal(finished.rows.flat().some(Boolean),false);
  for(const power of DICE_POWER_NAMES) {
    const g=Game.create({id:'power-'+power,code:'POW100',numRows:100,creator});g.join({id:'rival',name:'Rival'});
    const result=g.useDice(creator.id,()=>(DICE_POWER_NAMES.indexOf(power)+.5)/8);assert.equal(result.dice.power,power);
    if(power==='avalancha'||power==='fantasma')g.resolveDiceTarget(creator.id,{row:50,col:25});
    if(power==='antigua')g.launchAncientShot(creator.id,{row:99,col:0,dx:1,dy:0,power:1});
    assert.equal(g.toPrimitives().rows.length,100);
  }
  const trace=resolveAncientShot(Array.from({length:100},(_,r)=>Array(r+1).fill(1)),{row:99,col:0,dx:1,dy:0,power:1});
  assert.ok(trace.affected.length>1);assert.ok(trace.flight.points.length<=65);
  const active=await useCase.execute({playerId:creator.id,playerName:creator.name,numRows:100});
  const timed=(await repo.getById(active.gameId))!;timed.join({id:'time-rival',name:'Time QA'});await repo.save(timed);
  sqlite.prepare('UPDATE games SET updated_at=? WHERE id=?').run(new Date(Date.now()-GAME_INACTIVITY_MS).toISOString(),timed.id);
  await assert.rejects(()=>repo.getById(timed.id),(error:unknown)=>(error as {code:string}).code==='GAME_EXPIRED');
  console.log('OK: 1–100 rows; API/domain/use case reject invalid sizes; 5050 marbles persisted; complete 100-turn game; all eight powers on 100 rows; bounded shot physics; same 24h inactivity expiry.');
}
void main();
