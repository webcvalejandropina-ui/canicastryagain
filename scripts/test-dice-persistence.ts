import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
async function main(){
 const {Game}=await import('../src/backend/game/domain/Game');
 const {DICE_POWER_NAMES}=await import('../src/backend/game/domain/DicePowers');
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const {UseDiceUseCase}=await import('../src/backend/game/application/UseDiceUseCase');
 const {SqliteRankingRepository}=await import('../src/backend/ranking/infrastructure/SqliteRankingRepository');
 const {toGameView}=await import('../src/backend/game/application/GameView');
 const {rowsAtMove}=await import('../src/features/game/lib/replay');
 const repo=new SqliteGameRepository(),ranking=new SqliteRankingRepository(),use=new UseDiceUseCase(repo,ranking);
 for(const power of ['avalancha','fantasma'] as const){
  for(const last of [false,true]){
   const base=Game.create({id:power+last,code:(power==='avalancha'?'AVAL':'FANT')+(last?'01':'02'),numRows:3,creator:{id:'a',name:'A'}});base.join({id:'b',name:'B'});
   const g=last?Game.rehydrate({...base.toPrimitives(),rows:[[0],[0,0],[1,0,0]]}):base;
   g.useDice('a',()=>(DICE_POWER_NAMES.indexOf(power)+.5)/8);await repo.save(g);
   const restored=(await repo.getById(g.id))!,view=toGameView(restored,'a');
   assert.equal(view.pendingTargetPower,power);assert.equal(view.yourDiceAvailable,false);assert.equal(view.moveHistory.length,0);
   await assert.rejects(()=>use.execute({gameId:g.id,playerId:'b',target:{row:2,col:0}}));
   await assert.rejects(()=>use.execute({gameId:g.id,playerId:'intruder',target:{row:2,col:0}}));
   await assert.rejects(()=>use.execute({gameId:g.id,playerId:'a',target:{row:99,col:0}}));
   const request={gameId:g.id,playerId:'a',expectedRevision:restored.revision,target:{row:2,col:0}};
   const raced=await Promise.allSettled([use.execute(request),use.execute(request)]);
   assert.equal(raced.filter(x=>x.status==='fulfilled').length,1,'One confirmation, one saved turn');
   const after=(await repo.getById(g.id))!,a=toGameView(after,'a'),b=toGameView(after,'b');
   assert.equal(a.pendingTargetPower,null);assert.equal(a.moveHistory.length,1);assert.deepEqual(a.rows,b.rows);assert.deepEqual(a.moveHistory,b.moveHistory);
   if(!last)assert.deepEqual(rowsAtMove(3,a.moveHistory,0),a.rows);
   if(last){assert.equal(a.status,'finished');assert.equal(a.winner,2);}
   await assert.rejects(()=>use.execute(request));
  }
 }
 const g=Game.create({id:'shuffle',code:'SHUFFL',numRows:3,creator:{id:'a',name:'A'}});g.join({id:'b',name:'B'});g.makeMove({playerId:'a',rowIndex:2,startIndex:1,removeCount:1});
 g.useDice('b',()=>(DICE_POWER_NAMES.indexOf('remolino')+.5)/8);await repo.save(g);
 const restored=(await repo.getById(g.id))!.toPrimitives();assert.deepEqual(restored.rows,g.toPrimitives().rows);assert.deepEqual(restored.moveHistory,g.toPrimitives().moveHistory);
 assert.deepEqual(rowsAtMove(3,restored.moveHistory,1),restored.rows);
 console.log('OK: target power migration, pending reconnect, permissions, invalid targets, concurrent confirmations, single result and exact shuffle persistence');
}
void main();
