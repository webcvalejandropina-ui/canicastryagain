import { Game } from '../src/backend/game/domain/Game';
if(!process.env.SQLITE_PATH?.startsWith('/private/tmp/canicas-ancient-'))throw new Error('Use a disposable ancient QA database');
async function main(){
 const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');
 const repo=new SqliteGameRepository();
 const game=Game.create({id:'ancient-http-qa',code:'ANTIQA',numRows:7,creator:{id:'qa-one',name:'Uno QA'}});
 game.join({id:'qa-two',name:'Dos QA'});game.useDice('qa-one',()=>.99);await repo.save(game);
 console.log('Pending ancient shot fixture ready in disposable database');
}
void main();
