import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { makeGameDelta, applyGameDelta, gameDeltaBase } from '../src/features/game/lib/gameDelta';
import type { GameState } from '../src/features/game/types';
process.env.SQLITE_PATH=':memory:';
async function run(){
 const {Game}=await import('../src/backend/game/domain/Game');
 const {toGameView}=await import('../src/backend/game/application/GameView');
 const view=(g:ReturnType<typeof Game.create>,player:string)=>{g.markPersisted();return structuredClone(toGameView(g,player))};
 const game=Game.create({id:'delta',code:'DELTA1',numRows:7,creator:{id:'a',name:'A'}});
 let before:GameState=view(game,'a');
 game.join({id:'b',name:'B'});
 let after:GameState=view(game,'a');
 let patch=makeGameDelta(gameDeltaBase(before),after)!;
 assert.deepEqual(applyGameDelta(before,patch),after,'Joining updates metadata without moves');
 assert.equal(patch.appendedMoves.length,0);assert.equal(patch.changedRows.length,0);
 before=after;
 game.makeMove({playerId:'a',rowIndex:0,startIndex:0,removeCount:1});after=view(game,'a');
 patch=makeGameDelta(gameDeltaBase(before),after)!;
 assert.deepEqual(applyGameDelta(before,patch),after);assert.equal(patch.changedRows.length,1);assert.equal(patch.appendedMoves.length,1);
 assert.equal(applyGameDelta(after,patch),after,'An SSE echo after the HTTP response does not undo newer state');
 assert.equal(applyGameDelta(null,patch),null);
 assert.equal(applyGameDelta({...before,revision:0},patch),null,'Missing patch requires GET');
 assert.equal(applyGameDelta({...before,gameId:'wrong'},patch),null);
 assert.equal(applyGameDelta(before,{...patch,historyFrom:9}),null);
 assert.equal(applyGameDelta(before,{...patch,changedRows:[{index:99,cells:[0]}]}),null);
 assert.equal(applyGameDelta(before,{...patch,changedRows:[{index:0,cells:[2]}]}),null);
 assert.equal(applyGameDelta(before,{...patch,changedRows:[patch.changedRows[0],patch.changedRows[0]]}),null);
 assert.equal(makeGameDelta(gameDeltaBase(after),before),null);
 assert.equal(makeGameDelta(gameDeltaBase({...before,revision:undefined}),after),null);
 for(const power of Array.from({length:8},(_,i)=>(i+.5)/8)){
  const g=Game.create({id:'power'+power,code:'POWER1',numRows:7,creator:{id:'a',name:'A'}});g.join({id:'b',name:'B'});
  g.makeMove({playerId:'a',rowIndex:0,startIndex:0,removeCount:1});
  const prev=view(g,'b');g.useDice('b',()=>power);const next=view(g,'b');
  assert.deepEqual(applyGameDelta(prev,makeGameDelta(gameDeltaBase(prev),next)!),next,'All eight dice powers are lossless');
  if(next.pendingTargetPower){g.resolveDiceTarget('b',{row:6,col:0});const target=view(g,'b');assert.deepEqual(applyGameDelta(next,makeGameDelta(gameDeltaBase(next),target)!),target,'Target resolution is lossless');}
  if(next.pendingAncientShot){g.launchAncientShot('b',{row:6,col:0,dx:7,dy:0});const shot=view(g,'b');assert.deepEqual(applyGameDelta(next,makeGameDelta(gameDeltaBase(next),shot)!),shot,'Manual shot release is also lossless');}
 }
 // A fanout read may coalesce several commits. Reconstruct all changed rows and moves.
 const prev=view(game,'a');
 game.makeMove({playerId:'b',rowIndex:1,startIndex:0,removeCount:1});
 game.makeMove({playerId:'a',rowIndex:2,startIndex:0,removeCount:1});
 const next=view(game,'a');assert.deepEqual(applyGameDelta(prev,makeGameDelta(gameDeltaBase(prev),next)!),next);
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const {container}=await import('../src/backend/shared/infrastructure/container');
 const {GET:events}=await import('../src/app/api/games/[gameId]/events/route');
 const {publishGameUpdated}=await import('../src/backend/game/infrastructure/GameEvents');
 const {sqlite}=await import('../src/backend/shared/infrastructure/db/sqlite');
 const token='a'.repeat(64),cookie=`canicas_session=${token}`;
 sqlite.prepare('INSERT INTO players(id,alias,password_hash) VALUES(?,?,?)').run('a','A','fixture');
 sqlite.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'a',Date.now()+60000);
 const repo=new SqliteGameRepository();await repo.save(Game.rehydrate({...game.toPrimitives(),revision:0}));
 let reads=0;const original=container.getGameUseCase.execute.bind(container.getGameUseCase);
 container.getGameUseCase.execute=async input=>{reads++;return original(input)};
 const response=await events(new Request('http://localhost/api/games/delta/events?playerId=a&updates=delta',{headers:{cookie}}),{params:Promise.resolve({gameId:'delta'})});
 const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='';
 async function until(pattern:string){const timeout=setTimeout(()=>void reader.cancel(),2000);try{while(!buffer.includes(pattern)){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value);}}finally{clearTimeout(timeout);}}
 await until('event: ready');assert.equal(reads,1,'Subscribe does not decode the same snapshot twice');
 const loaded=(await repo.getById('delta'))!;
 loaded.makeMove({playerId:'b',rowIndex:3,startIndex:0,removeCount:1});await repo.save(loaded);publishGameUpdated(loaded.id,'move',loaded);
 await until('"delta":');assert.equal(reads,1,'Committed local updates do not reload SQLite per subscriber');
 const frames=buffer.split('\n\n').map(frame=>frame.split('\n').find(line=>line.startsWith('data: '))).filter(Boolean).map(line=>JSON.parse(line!.slice(6)));
 const ready=frames.find(f=>f.game).game;const wire=frames.find(f=>f.delta).delta;
 assert.deepEqual(applyGameDelta(ready,wire),toGameView(loaded,'a'));
 publishGameUpdated(loaded.id,'manual');await new Promise(r=>setImmediate(r));assert.equal(reads,1,'Duplicate notifications perform no full snapshot reads');
 await reader.cancel();container.getGameUseCase.execute=original;
 console.log('OK: compact deltas, joins, eight powers, coalescing, stale echoes, missing/malformed patches, opt-in SSE and zero redundant snapshot reads');
}
void run().catch(error=>{console.error(error);process.exitCode=1});
