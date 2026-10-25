import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
async function run(){
 const {Game}=await import('../src/backend/game/domain/Game');
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const {JoinGameUseCase}=await import('../src/backend/game/application/JoinGameUseCase');
 const {toGameView}=await import('../src/backend/game/application/GameView');
 const repo=new SqliteGameRepository(),join=new JoinGameUseCase(repo);
 const game=Game.create({id:'private',code:'PRIV01',numRows:7,creator:{id:'host',name:'Host'},privateInvitation:true} as any);
 await repo.save(game);
 const view=toGameView(game,'host') as any;assert.equal(view.privateInvitation,true);assert.match(view.inviteToken,/^cta2\.[A-Za-z0-9_-]{43}$/);
 assert.ok(Date.parse(view.invitationExpiresAt)>Date.now());
 await assert.rejects(join.execute({playerId:'other',playerName:'Host',gameCode:'WRONG1'}),{code:'GAME_NOT_FOUND'});
 const results=await Promise.allSettled(['guest-a','guest-b'].map(playerId=>join.execute({playerId,playerName:'Invitado',inviteToken:view.inviteToken})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'Only one rival can claim the private slot');
 const saved=(await repo.getById('private'))!;assert.equal(saved.status,'playing');assert.equal(saved.toPrimitives().moveHistory.length,0);
 assert.equal(toGameView(saved,'host').inviteToken,'','The active match stops exposing the invitation');
 const guest=saved.player2!;assert.equal((await join.execute({playerId:guest.id,playerName:guest.name,inviteToken:view.inviteToken})).status,'playing','The accepted visitor can recover a lost response');
 await assert.rejects(join.execute({playerId:'third',playerName:'Invitado',inviteToken:view.inviteToken}),{code:'INVITE_ALREADY_USED'});
 const expired=Game.create({id:'expired',code:'EXPR01',numRows:3,creator:{id:'host',name:'Host'},privateInvitation:true} as any);
 const state=expired.toPrimitives() as any;state.privateInviteExpiresAt=new Date(Date.now()-1000).toISOString();const old=Game.rehydrate(state);await repo.save(old);
 await assert.rejects(join.execute({playerId:'late',playerName:'Tarde',inviteToken:(toGameView(old,'host') as any).inviteToken}),{code:'INVITE_EXPIRED'});
 console.log('OK: private opaque links, expiry, wrong-code rejection, one rival, idempotent recovery and immediate playing state');
}
void run().catch(e=>{console.error(e);process.exitCode=1});
