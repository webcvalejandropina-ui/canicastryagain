import { sqlite } from '../src/backend/shared/infrastructure/db/sqlite';
import { hashPassword } from '../src/backend/player/domain/PasswordHasher';
if(!process.env.SQLITE_PATH?.startsWith('/private/tmp/canicas-rivals-'))throw new Error('Only disposable rivals QA databases');
async function main(){
const passwordHash=await hashPassword('PruebaLocal2026');
const players=[['rival-qa-alba','RivalQA Alba'],['rival-qa-bruno','RivalQA Bruno'],['rival-qa-carla','RivalQA Carla']];
for(const [id,name] of players)sqlite.prepare('INSERT OR IGNORE INTO players(id,alias,password_hash) VALUES(?,?,?)').run(id,name,passwordHash);
const insert=sqlite.prepare(`INSERT OR IGNORE INTO games(id,code,num_rows,rows_json,status,current_turn,winner,player1_id,player1_name,player2_id,player2_name,move_history_json,created_at,updated_at) VALUES(?,?,3,'[[0],[0,0],[0,0,0]]','finished',1,?,'rival-qa-alba','RivalQA Alba','rival-qa-bruno','RivalQA Bruno','[]',?,?)`);
for(let i=1;i<=3;i++)insert.run(`rival-qa-${i}`,`QA000${i}`,i===3?2:1,`2026-10-${20+i}T12:00:00Z`,`2026-10-${20+i}T12:00:00Z`);
console.log('Disposable rival accounts and three shared games ready');

}
void main();
