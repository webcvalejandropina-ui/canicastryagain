/** Test fixtures only. No bypass endpoint or weakening of production authentication. */
import Database from 'better-sqlite3';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
export function createQaActors(count) {
  const path=process.env.QA_SQLITE_PATH;
  if(!path||!/^\/(?:private\/)?tmp\/[\w-]+-qa\.db$/.test(path)||!/^\/private\/tmp\/[\w-]+-qa\.db$/.test(realpathSync(path)))throw Error('QA_SQLITE_PATH must be an existing disposable /private/tmp/*-qa.db, never a production database');
  const db=new Database(path);db.pragma('busy_timeout=1000');
  const actors=Array.from({length:count},(_,i)=>{const token=randomBytes(32).toString('hex');return {playerId:'guest-'+randomUUID(),playerName:`QA ${i+1}`,cookie:'canicas_guest_session='+token,hash:createHash('sha256').update(token).digest('hex')}});
  db.transaction(()=>{const insert=db.prepare('INSERT INTO game_guest_sessions(token_hash,player_id,player_name,expires) VALUES(?,?,?,?)');for(const a of actors)insert.run(a.hash,a.playerId,a.playerName,Date.now()+1800000)})();db.close();
  return {actors,cleanup(){const db=new Database(path);db.pragma('busy_timeout=1000');db.transaction(()=>{const remove=db.prepare('DELETE FROM game_guest_sessions WHERE token_hash=?');actors.forEach(a=>remove.run(a.hash))})();db.close()}};
}
