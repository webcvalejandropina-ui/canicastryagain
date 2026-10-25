import { migrateRivalRowCount } from './migrateRowCount';
import { MIN_ROWS, MAX_ROWS } from '@/shared/gameConfig';
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';
import { Game } from '@/backend/game/domain/Game';
import { generateRandomGameCode } from '@/backend/game/domain/GameCode';
import { AppError } from '@/backend/shared/domain/AppError';
import type { Rival, RivalData, RivalInvitation } from '@/features/social/types';

type InvitationRow = { id: string; sender: string; recipient: string; num_rows: number; status: string; expires: number; game_id: string | null };
const DAY = 24 * 60 * 60 * 1000;

/** All mutations are synchronous transactions: accepting creates exactly one game. */
export class RivalStore {
  constructor(private readonly db: Database, private readonly now = Date.now) {
    db.transaction(() => { db.exec(`
      CREATE TABLE IF NOT EXISTS rival_hidden (
        owner TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        rival TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        PRIMARY KEY(owner,rival), CHECK(owner<>rival)
      );
      CREATE TABLE IF NOT EXISTS rival_invitations (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        recipient TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        num_rows INTEGER NOT NULL CHECK(typeof(num_rows)='integer' AND num_rows BETWEEN 1 AND 100),
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled')),
        created INTEGER NOT NULL, expires INTEGER NOT NULL,
        game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
        CHECK(sender<>recipient)
      );
      CREATE INDEX IF NOT EXISTS idx_rival_sender ON rival_invitations(sender,status,expires);
      CREATE INDEX IF NOT EXISTS idx_rival_recipient ON rival_invitations(recipient,status,expires);
      CREATE INDEX IF NOT EXISTS idx_games_player1_history ON games(player1_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_games_player2_history ON games(player2_id,status,updated_at DESC);
    `); migrateRivalRowCount(db); }).immediate();
  }

  private history(owner: string): Array<Rival & { hidden: number }> {
    return this.db.prepare(`
      WITH shared AS (
        SELECT player2_id rival, updated_at played, status,
          CASE WHEN winner=1 THEN 1 ELSE 0 END won FROM games
          WHERE player1_id=? AND player2_id IS NOT NULL AND status IN ('playing','finished')
        UNION ALL
        SELECT player1_id rival, updated_at played, status,
          CASE WHEN winner=2 THEN 1 ELSE 0 END won FROM games
          WHERE player2_id=? AND player1_id IS NOT NULL AND status IN ('playing','finished')
      )
      SELECT p.id, p.alias name, SUM(CASE WHEN s.status='finished' THEN 1 ELSE 0 END) games,
        SUM(s.won) wins, MAX(s.played) lastPlayed,
        CASE WHEN h.rival IS NULL THEN 0 ELSE 1 END hidden
      FROM shared s JOIN players p ON p.id=s.rival
      LEFT JOIN rival_hidden h ON h.owner=? AND h.rival=p.id
      WHERE p.id<>? GROUP BY p.id ORDER BY lastPlayed DESC, p.id
    `).all(owner, owner, owner, owner) as Array<Rival & { hidden: number }>;
  }

  list(owner: string): RivalData {
    const history = this.history(owner);
    const invitations = this.db.prepare(`
      SELECT i.id, CASE WHEN i.sender=@owner THEN i.recipient ELSE i.sender END rivalId,
        p.alias name, i.recipient=@owner incoming, i.status, i.num_rows numRows,
        i.expires expiresAt, CASE WHEN i.status='accepted' THEN g.code END gameCode
      FROM rival_invitations i
      JOIN players p ON p.id=CASE WHEN i.sender=@owner THEN i.recipient ELSE i.sender END
      LEFT JOIN games g ON g.id=i.game_id
      WHERE (i.sender=@owner OR i.recipient=@owner)
        AND ((i.status='pending' AND i.expires>@now) OR (i.status='accepted' AND g.status='playing'))
      ORDER BY i.created DESC LIMIT 50
    `).all({owner, now:this.now()}) as Array<Omit<RivalInvitation,'incoming'> & {incoming:number}>;
    const clean = (rival: Rival) => ({id:rival.id,name:rival.name,games:rival.games,wins:rival.wins,lastPlayed:rival.lastPlayed});
    return {
      rivals: history.filter(r=>!r.hidden).map(clean),
      hidden: history.filter(r=>r.hidden).map(clean),
      invitations: invitations.map(i=>({...i,incoming:Boolean(i.incoming)})),
    };
  }

  hide(owner: string, rival: string): void {
    this.db.transaction(() => {
      if (!this.history(owner).some(r=>r.id===rival)) throw new AppError('Rival no encontrado',404);
      this.db.prepare('INSERT OR IGNORE INTO rival_hidden(owner,rival) VALUES(?,?)').run(owner,rival);
      this.db.prepare("UPDATE rival_invitations SET status='cancelled' WHERE status='pending' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))").run(owner,rival,rival,owner);
    }).immediate();
  }

  restore(owner: string, rival: string): void {
    this.db.prepare('DELETE FROM rival_hidden WHERE owner=? AND rival=?').run(owner,rival);
  }

  invite(owner: string, rival: string, numRows: number): {id:string} {
    z.number().int().min(MIN_ROWS).max(MAX_ROWS).parse(numRows);
    return this.db.transaction(() => {
      if (!this.history(owner).some(r=>r.id===rival && !r.hidden)) throw new AppError('Solo puedes invitar a rivales de tu lista',403);
      // Removing a rival is private. Do not reveal the other player's preference.
      if (this.db.prepare('SELECT 1 FROM rival_hidden WHERE owner=? AND rival=?').get(rival,owner)) {
        throw new AppError('No se puede enviar esta invitación',409);
      }
      const active=this.db.prepare(`SELECT i.id FROM rival_invitations i LEFT JOIN games g ON g.id=i.game_id
        WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?))
        AND ((i.status='pending' AND expires>?) OR (i.status='accepted' AND g.status='playing')) LIMIT 1`).get(owner,rival,rival,owner,this.now()) as {id:string}|undefined;
      if(active) return active;
      const count=this.db.prepare("SELECT COUNT(*) n FROM rival_invitations WHERE sender=? AND status='pending' AND expires>?").get(owner,this.now()) as {n:number};
      if(count.n>=20) throw new AppError('Ya tienes 20 invitaciones pendientes. Cancela alguna antes de enviar otra.',429);
      const id=randomUUID();
      this.db.prepare("INSERT INTO rival_invitations(id,sender,recipient,num_rows,status,created,expires) VALUES(?,?,?,?,'pending',?,?)").run(id,owner,rival,numRows,this.now(),this.now()+DAY);
      return {id};
    }).immediate();
  }

  respond(owner: string, id: string, action: 'accept'|'decline'|'cancel'): {gameCode:string|null; gameId?:string} {
    return this.db.transaction(() => {
      const invite=this.db.prepare('SELECT * FROM rival_invitations WHERE id=?').get(id) as InvitationRow|undefined;
      if(!invite || (invite.sender!==owner && invite.recipient!==owner)) throw new AppError('Invitación no encontrada',404);
      if(action==='cancel' ? invite.sender!==owner : invite.recipient!==owner) throw new AppError('No puedes responder a esta invitación',403);
      if(action==='accept' && invite.status==='accepted') {
        const game=this.db.prepare("SELECT code FROM games WHERE id=? AND status='playing'").get(invite.game_id) as {code:string}|undefined;
        if(game) return {gameCode:game.code,gameId:invite.game_id!};
      }
      if(invite.status!=='pending' || invite.expires<=this.now()) throw new AppError('La invitación ya no está disponible',410);
      if(action!=='accept') {
        this.db.prepare('UPDATE rival_invitations SET status=? WHERE id=?').run(action==='cancel'?'cancelled':'declined',id);
        return {gameCode:null};
      }
      for (const player of [invite.sender,invite.recipient]) {
        const {n}=this.db.prepare(`SELECT count(*) n FROM games WHERE (player1_id=? OR player2_id=?) AND
          ((status='playing' AND updated_at>?) OR (status='waiting' AND created_at>?))`).get(player,player,new Date(this.now()-DAY).toISOString(),new Date(this.now()-300000).toISOString()) as {n:number};
        if(n>=5)throw new AppError('Uno de los jugadores ya tiene cinco partidas abiertas.',409,'ACTIVE_GAME_LIMIT');
      }
      const sender=this.db.prepare('SELECT id,alias name FROM players WHERE id=?').get(invite.sender) as {id:string;name:string};
      const recipient=this.db.prepare('SELECT id,alias name FROM players WHERE id=?').get(invite.recipient) as {id:string;name:string};
      let code='';
      for(let attempt=0;attempt<30;attempt++) {
        const candidate=generateRandomGameCode();
        if(!this.db.prepare('SELECT 1 FROM games WHERE code=?').get(candidate)){code=candidate;break;}
      }
      if(!code) throw new AppError('No se pudo preparar la partida. Inténtalo de nuevo.',503);
      const game=Game.create({id:randomUUID(),code,numRows:invite.num_rows,creator:sender});
      game.join(recipient);
      const s=game.toPrimitives();
      this.db.prepare(`INSERT INTO games(id,code,revision,invite_version,num_rows,rows_json,status,current_turn,
        player1_id,player1_name,player2_id,player2_name,move_history_json,created_at,updated_at)
        VALUES(?,?,1,?,?,?,?,?,?,?,?,?,'[]',?,?)`).run(s.id,s.code,s.inviteVersion,s.numRows,JSON.stringify(s.rows),s.status,s.currentTurn,s.player1!.id,s.player1!.name,s.player2!.id,s.player2!.name,s.createdAt,s.updatedAt);
      this.db.prepare("UPDATE rival_invitations SET status='accepted',game_id=? WHERE id=?").run(s.id,id);
      return {gameCode:s.code,gameId:s.id};
    }).immediate();
  }
}
