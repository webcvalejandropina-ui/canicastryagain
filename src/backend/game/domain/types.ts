export type GameStatus = 'waiting' | 'playing' | 'finished';

export type PlayerNumber = 1 | 2;

export type PlayerSlot = {
  id: string;
  name: string;
};

export type Move = {
  player: PlayerNumber;
  rowIndex: number;
  startIndex: number;
  count: number;
  timestamp: string;
  /** Una sola entrada por tirada de dado (no una por celda afectada). */
  fromDice?: boolean;
};

export type DicePowerName = 'bomba' | 'rayo' | 'diagonal' | 'resurreccion';

export type DiceResult = {
  power: DicePowerName;
  affected: Array<{ row: number; col: number }>;
};

export type GamePrimitives = {
  id: string;
  code: string;
  inviteVersion: number;
  numRows: number;
  /**
   * Representa cada fila como un array de celdas.
   * 1 = canica presente, 0 = hueco (canica eliminada).
   * La longitud de la fila N es N + 1.
   */
  rows: number[][];
  status: GameStatus;
  currentTurn: PlayerNumber;
  forcedRowIndex: number | null;
  turnDieValue: number | null;
  lastTouchedRowIndex: number | null;
  winner: PlayerNumber | null;
  player1: PlayerSlot | null;
  player2: PlayerSlot | null;
  player1DiceUsed: boolean;
  player2DiceUsed: boolean;
  moveHistory: Move[];
  createdAt: string;
  updatedAt: string;
};
