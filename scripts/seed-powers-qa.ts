import {Game} from '../src/backend/game/domain/Game';
import {DICE_POWER_NAMES} from '../src/backend/game/domain/DicePowers';
if(!process.env.SQLITE_PATH?.startsWith('/private/tmp/canicas-powers-'))throw new Error('Use disposable powers QA database');
async function main(){const {SqliteGameRepository}=await import('../src/backend/game/infrastructure/SqliteGameRepository');const repo=new SqliteGameRepository();
 for(const power of ['avalancha','fantasma'] as const){const g=Game.create({id:'qa-'+power,code:power==='avalancha'?'AVALQA':'FANTQA',numRows:7,creator:{id:'qa-a',name:'Uno QA'}});g.join({id:'qa-b',name:'Dos QA'});g.useDice('qa-a',()=>(DICE_POWER_NAMES.indexOf(power)+.5)/8);await repo.save(g);}
 console.log('Two pending target fixtures ready');}
void main();
