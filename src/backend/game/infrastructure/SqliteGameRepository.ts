import { GAME_INACTIVITY_MS, isGameInactive } from "../domain/GameInactivity";
import { AppError } from "@/backend/shared/domain/AppError";
import { Game } from "@/backend/game/domain/Game";
import { GameRepository } from "@/backend/game/domain/GameRepository";
import { GamePrimitives, Move } from "@/backend/game/domain/types";
import { sqlite } from "@/backend/shared/infrastructure/db/sqlite";

type GameRow = {
  revision: number;
  id: string;
  code: string;
  invite_version: number | null;
  private_invite_token: string | null;
  private_invite_expires_at: string | null;
  num_rows: number;
  rows_json: string;
  status: GamePrimitives["status"];
  current_turn: number;
  pending_ancient_shot: number;
  pending_target_power: GamePrimitives["pendingTargetPower"];
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
    revision,
    id,
    code,
    invite_version,
    private_invite_token,
    private_invite_expires_at,
    num_rows,
    rows_json,
    status,
    current_turn,
    pending_ancient_shot,
    pending_target_power,
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
  ) SELECT
    @revision,
    @id,
    @code,
    @invite_version,
    @private_invite_token,
    @private_invite_expires_at,
    @num_rows,
    @rows_json,
    @status,
    @current_turn,
    @pending_ancient_shot,
    @pending_target_power,
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
  WHERE @expected_revision = 0 OR EXISTS (
    SELECT 1 FROM games WHERE id = @id AND revision = @expected_revision
  )
  ON CONFLICT(id) DO UPDATE SET
    revision = excluded.revision,
    code = excluded.code,
    invite_version = excluded.invite_version,
    private_invite_token = excluded.private_invite_token,
    private_invite_expires_at = excluded.private_invite_expires_at,
    num_rows = excluded.num_rows,
    rows_json = excluded.rows_json,
    status = excluded.status,
    current_turn = excluded.current_turn,
    pending_ancient_shot = excluded.pending_ancient_shot,
    pending_target_power = excluded.pending_target_power,
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
  WHERE games.revision = @expected_revision AND (games.status != 'playing' OR games.updated_at > @inactivity_cutoff)
`);

const getByIdStatement = sqlite.prepare(
  "SELECT * FROM games WHERE id = ? LIMIT 1",
);
const getByCodeStatement = sqlite.prepare(
  "SELECT * FROM games WHERE code = ? LIMIT 1",
);
const deleteByIdStatement = sqlite.prepare("DELETE FROM games WHERE id = ?");
const deleteExpiredWaitingGamesStatement = sqlite.prepare(
  "DELETE FROM games WHERE status = 'waiting' AND created_at <= ?",
);

function isWaitingRowExpired(row: GameRow, nowMs = Date.now()): boolean {
  if (row.status !== "waiting") {
    return false;
  }

  const createdAtMs = Date.parse(row.created_at);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return nowMs - createdAtMs >= WAITING_GAME_TTL_MS;
}

function requireActiveRow(row: GameRow): void {
  if(isGameInactive(row.status,row.updated_at))
    throw new AppError("La partida ha caducado tras 24 horas sin jugadas. Crea una nueva para volver a jugar.",410,"GAME_EXPIRED");
}

function mapRowToEntity(row: GameRow): Game {
  requireActiveRow(row);
  const parsedRows = JSON.parse(row.rows_json) as unknown;
  const moveHistory = JSON.parse(row.move_history_json) as Move[];

  let rows: number[][];

  // Compatibilidad hacia atrás: antes se guardaba como number[]
  if (
    Array.isArray(parsedRows) &&
    parsedRows.every((value) => typeof value === "number")
  ) {
    rows = (parsedRows as number[]).map((count, rowIndex) =>
      Array.from({ length: rowIndex + 1 }, (_, cellIndex) =>
        cellIndex < count ? 1 : 0,
      ),
    );
  } else {
    rows = parsedRows as number[][];
  }

  const state: GamePrimitives = {
    revision: row.revision ?? 0,
    id: row.id,
    code: row.code,
    inviteVersion:
      row.invite_version && row.invite_version > 0 ? row.invite_version : 1,
    privateInviteToken: row.private_invite_token,
    privateInviteExpiresAt: row.private_invite_expires_at,
    numRows: row.num_rows,
    rows,
    status: row.status,
    currentTurn: row.current_turn === 2 ? 2 : 1,
    pendingAncientShot: Boolean(row.pending_ancient_shot),
    pendingTargetPower: row.pending_target_power??null,
    forcedRowIndex: row.forced_row_index,
    turnDieValue: row.turn_die_value,
    lastTouchedRowIndex: row.last_touched_row_index,
    winner: row.winner === 2 ? 2 : row.winner === 1 ? 1 : null,
    player1:
      row.player1_id && row.player1_name
        ? {
            id: row.player1_id,
            name: row.player1_name,
          }
        : null,
    player2:
      row.player2_id && row.player2_name
        ? {
            id: row.player2_id,
            name: row.player2_name,
          }
        : null,
    player1DiceUsed: Boolean(row.player1_dice_used),
    player2DiceUsed: Boolean(row.player2_dice_used),
    moveHistory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return Game.rehydrate(state);
}

export class SqliteGameRepository implements GameRepository {
  async save(game: Game): Promise<void> {
    const state = game.toPrimitives();

    const result = sqlite.transaction(() => {
      const existing = getByIdStatement.get(state.id) as GameRow | undefined;
      const cutoff = new Date(Date.now()-GAME_INACTIVITY_MS).toISOString();
      const waitingCutoff = new Date(Date.now()-WAITING_GAME_TTL_MS).toISOString();
      if (state.status !== 'finished') for (const player of [state.player1, state.player2]) {
        if (!player || existing?.player1_id === player.id || existing?.player2_id === player.id) continue;
        const {n} = sqlite.prepare(`SELECT count(*) AS n FROM games WHERE
          (player1_id=? OR player2_id=?) AND ((status='playing' AND updated_at>?) OR (status='waiting' AND created_at>?))`)
          .get(player.id,player.id,cutoff,waitingCutoff) as {n:number};
        if (n >= 5) throw new AppError('Ya tienes cinco partidas abiertas. Termina o abandona una antes de abrir otra.',409,'ACTIVE_GAME_LIMIT');
      }
      return upsertStatement.run({
      inactivity_cutoff: new Date(Date.now()-GAME_INACTIVITY_MS).toISOString(),
      expected_revision: game.revision,
      revision: game.revision + 1,
      id: state.id,
      code: state.code,
      invite_version: state.inviteVersion,
      private_invite_token: state.privateInviteToken ?? null,
      private_invite_expires_at: state.privateInviteExpiresAt ?? null,
      num_rows: state.numRows,
      rows_json: JSON.stringify(state.rows),
      status: state.status,
      current_turn: state.currentTurn,
      pending_ancient_shot: state.pendingAncientShot ? 1 : 0,
      pending_target_power: state.pendingTargetPower??null,
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
      updated_at: state.updatedAt,
    });
    }).immediate();
    if (result.changes !== 1) {
      const existing=getByIdStatement.get(state.id) as GameRow|undefined;
      if(existing)requireActiveRow(existing);
      throw new AppError(
        "La partida ha cambiado. Sincroniza antes de volver a jugar.",
        409,
        "STALE_GAME_STATE",
      );
    }
    game.markPersisted();
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

  async getByInviteToken(inviteToken: string): Promise<Game | null> {
    const row = sqlite.prepare('SELECT * FROM games WHERE private_invite_token = ? LIMIT 1').get(inviteToken) as GameRow | undefined;
    return row ? mapRowToEntity(row) : null;
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
