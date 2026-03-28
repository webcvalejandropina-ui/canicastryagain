import { Game } from '@/backend/game/domain/Game';
import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GamePrimitives, Move } from '@/backend/game/domain/types';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

type GameRow = {
  id: string;
  code: string;
  invite_version: number | null;
  num_rows: number;
  rows_json: string;
  status: GamePrimitives['status'];
  current_turn: number;
  forced_row_index: number | null;
  turn_die_value: number | null;
  last_touched_row_index: number | null;
  winner: number | null;
  player1_id: string | null;
  player1_name: string | null;
  player2_id: string | null;
  player2_name: string | null;
  player1_dice_used: number | null;
  player2_dice_used: number | null;
  move_history_json: string;
  created_at: string;
  updated_at: string;
};

const WAITING_GAME_TTL_MS = 5 * 60 * 1000;

const upsertStatement = sqlite.prepare(`
  INSERT INTO games (
    id,
    code,
    invite_version,
    num_rows,
    rows_json,
    status,
    current_turn,
    forced_row_index,
    turn_die_value,
    last_touched_row_index,
    winner,
    player1_id,
    player1_name,
    player2_id,
    player2_name,
    player1_dice_used,
    player2_dice_used,
    move_history_json,
    created_at,
    updated_at
  ) VALUES (
    @id,
    @code,
    @invite_version,
    @num_rows,
    @rows_json,
    @status,
    @current_turn,
    @forced_row_index,
    @turn_die_value,
    @last_touched_row_index,
    @winner,
    @player1_id,
    @player1_name,
    @player2_id,
    @player2_name,
    @player1_dice_used,
    @player2_dice_used,
    @move_history_json,
    @created_at,
    @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    invite_version = excluded.invite_version,
    num_rows = excluded.num_rows,
    rows_json = excluded.rows_json,
    status = excluded.status,
    current_turn = excluded.current_turn,
    forced_row_index = excluded.forced_row_index,
    turn_die_value = excluded.turn_die_value,
    last_touched_row_index = excluded.last_touched_row_index,
    winner = excluded.winner,
    player1_id = excluded.player1_id,
    player1_name = excluded.player1_name,
    player2_id = excluded.player2_id,
    player2_name = excluded.player2_name,
    player1_dice_used = excluded.player1_dice_used,
    player2_dice_used = excluded.player2_dice_used,
    move_history_json = excluded.move_history_json,
    updated_at = excluded.updated_at
`);

const getByIdStatement = sqlite.prepare('SELECT * FROM games WHERE id = ? LIMIT 1');
const getByCodeStatement = sqlite.prepare('SELECT * FROM games WHERE code = ? LIMIT 1');
const deleteByIdStatement = sqlite.prepare('DELETE FROM games WHERE id = ?');
const deleteExpiredWaitingGamesStatement = sqlite.prepare(
  "DELETE FROM games WHERE status = 'waiting' AND created_at <= ?"
);

function isWaitingRowExpired(row: GameRow, nowMs = Date.now()): boolean {
  if (row.status !== 'waiting') {
    return false;
  }

  const createdAtMs = Date.parse(row.created_at);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return nowMs - createdAtMs >= WAITING_GAME_TTL_MS;
}

function mapRowToEntity(row: GameRow): Game {
  const parsedRows = JSON.parse(row.rows_json) as unknown;
  const moveHistory = JSON.parse(row.move_history_json) as Move[];

  let rows: number[][];

  // Compatibilidad hacia atrás: antes se guardaba como number[]
  if (Array.isArray(parsedRows) && parsedRows.every((value) => typeof value === 'number')) {
    rows = (parsedRows as number[]).map((count, rowIndex) =>
      Array.from({ length: rowIndex + 1 }, (_, cellIndex) => (cellIndex < count ? 1 : 0))
    );
  } else {
    rows = parsedRows as number[][];
  }

  const state: GamePrimitives = {
    id: row.id,
    code: row.code,
    inviteVersion: row.invite_version && row.invite_version > 0 ? row.invite_version : 1,
    numRows: row.num_rows,
    rows,
    status: row.status,
    currentTurn: (row.current_turn === 2 ? 2 : 1),
    forcedRowIndex: row.forced_row_index,
    turnDieValue: row.turn_die_value,
    lastTouchedRowIndex: row.last_touched_row_index,
    winner: row.winner === 2 ? 2 : row.winner === 1 ? 1 : null,
    player1:
      row.player1_id && row.player1_name
        ? {
            id: row.player1_id,
            name: row.player1_name
          }
        : null,
    player2:
      row.player2_id && row.player2_name
        ? {
            id: row.player2_id,
            name: row.player2_name
          }
        : null,
    player1DiceUsed: Boolean(row.player1_dice_used),
    player2DiceUsed: Boolean(row.player2_dice_used),
    moveHistory,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  return Game.rehydrate(state);
}

export class SqliteGameRepository implements GameRepository {
  async save(game: Game): Promise<void> {
    const state = game.toPrimitives();

    upsertStatement.run({
      id: state.id,
      code: state.code,
      invite_version: state.inviteVersion,
      num_rows: state.numRows,
      rows_json: JSON.stringify(state.rows),
      status: state.status,
      current_turn: state.currentTurn,
      forced_row_index: state.forcedRowIndex,
      turn_die_value: state.turnDieValue,
      last_touched_row_index: state.lastTouchedRowIndex,
      winner: state.winner,
      player1_id: state.player1?.id ?? null,
      player1_name: state.player1?.name ?? null,
      player2_id: state.player2?.id ?? null,
      player2_name: state.player2?.name ?? null,
      player1_dice_used: state.player1DiceUsed ? 1 : 0,
      player2_dice_used: state.player2DiceUsed ? 1 : 0,
      move_history_json: JSON.stringify(state.moveHistory),
      created_at: state.createdAt,
      updated_at: state.updatedAt
    });
  }

  async getById(gameId: string): Promise<Game | null> {
    const row = getByIdStatement.get(gameId) as GameRow | undefined;
    if (!row) {
      return null;
    }

    if (isWaitingRowExpired(row)) {
      deleteByIdStatement.run(row.id);
      return null;
    }

    return mapRowToEntity(row);
  }

  async getByCode(gameCode: string): Promise<Game | null> {
    const row = getByCodeStatement.get(gameCode) as GameRow | undefined;
    if (!row) {
      return null;
    }

    if (isWaitingRowExpired(row)) {
      deleteByIdStatement.run(row.id);
      return null;
    }

    return mapRowToEntity(row);
  }

  async deleteById(gameId: string): Promise<void> {
    deleteByIdStatement.run(gameId);
  }

  async deleteExpiredWaitingGames(cutoffIso: string): Promise<number> {
    const result = deleteExpiredWaitingGamesStatement.run(cutoffIso);
    return result.changes;
  }
}
