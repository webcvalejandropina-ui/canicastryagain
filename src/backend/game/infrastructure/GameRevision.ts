import { isGameInactive } from "../domain/GameInactivity";
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
const statement = sqlite.prepare('SELECT revision, status, created_at, updated_at, player1_id, player2_id FROM games WHERE id = ?');
/** No rows/history JSON parsing and no writes on an idle read. */
export function readGameRevision(id: string, playerId?: string): number | null {
  const row = statement.get(id) as { revision: number; status: string; created_at: string; updated_at: string; player1_id: string | null; player2_id: string | null } | undefined;
  if (!row || (row.status === 'waiting' && Date.now() - Date.parse(row.created_at) >= 300000)) return null;
  if (isGameInactive(row.status,row.updated_at)) return null;
  if (playerId !== undefined && playerId !== row.player1_id && playerId !== row.player2_id) return null;
  return row.revision;
}

/** A single scalar: only commits by another connection invalidate this connection. */
export function readDatabaseVersion(): number {
  return Number(sqlite.pragma('data_version', { simple: true }));
}
