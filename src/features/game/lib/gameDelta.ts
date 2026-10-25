import type { GameState, Move } from '../types';

/** Opt-in wire format: full state on connect, changed rows + new moves thereafter. */
export type GameDelta = Omit<GameState, 'rows' | 'moveHistory' | 'revision'> & {
  revision: number;
  baseRevision: number;
  historyFrom: number;
  changedRows: Array<{ index: number; cells: number[] }>;
  appendedMoves: Move[];
};

export type GameDeltaBase = Pick<GameState, 'gameId' | 'revision' | 'numRows' | 'rows'> & { historyLength: number };

/** Keep only the board + counters per socket, not a second retained full history. */
export function gameDeltaBase(game: GameState): GameDeltaBase {
  return { gameId: game.gameId, revision: game.revision, numRows: game.numRows,
    rows: game.rows.map(row => row.slice()), historyLength: game.moveHistory.length };
}

export function makeGameDelta(previous: GameDeltaBase, next: GameState): GameDelta | null {
  if (previous.gameId !== next.gameId || previous.revision === undefined ||
      next.revision === undefined || next.revision <= previous.revision ||
      next.numRows !== previous.numRows || next.rows.length !== previous.rows.length ||
      next.moveHistory.length < previous.historyLength) return null;
  const { rows, moveHistory, ...metadata } = next;
  const changedRows: GameDelta['changedRows'] = [];
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].length !== previous.rows[index].length) return null;
    if (rows[index].some((cell, column) => cell !== previous.rows[index][column])) {
      changedRows.push({ index, cells: rows[index] });
    }
  }
  // The domain history is append-only, including dice and manual shots.
  return { ...metadata, revision: next.revision, baseRevision: previous.revision,
    historyFrom: previous.historyLength, changedRows,
    appendedMoves: moveHistory.slice(previous.historyLength) };
}

/** Missing/out-of-order patches recover with an authoritative GET, never guess. */
export function applyGameDelta(current: GameState | null, delta: GameDelta): GameState | null {
  if (!current || current.gameId !== delta.gameId || current.revision === undefined ||
      !Number.isSafeInteger(delta.revision) || !Number.isSafeInteger(delta.baseRevision) ||
      delta.revision <= delta.baseRevision) return null;
  if (current.revision >= delta.revision) return current;
  if (current.revision !== delta.baseRevision || delta.historyFrom !== current.moveHistory.length ||
      delta.numRows !== current.numRows || !Array.isArray(delta.changedRows) ||
      !Array.isArray(delta.appendedMoves)) return null;
  const rows = current.rows.slice();
  const seen = new Set<number>();
  for (const row of delta.changedRows) {
    if (!Number.isInteger(row.index) || row.index < 0 || row.index >= rows.length ||
        seen.has(row.index) || !Array.isArray(row.cells) || row.cells.length !== rows[row.index].length ||
        row.cells.some(cell => cell !== 0 && cell !== 1)) return null;
    seen.add(row.index);
    rows[row.index] = row.cells;
  }
  // Strip wire-only fields before exposing the reconstructed game to the UI.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { baseRevision, historyFrom, changedRows, appendedMoves, ...metadata } = delta;
  return { ...metadata, rows, moveHistory: [...current.moveHistory, ...appendedMoves] };
}
