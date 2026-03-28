export type PlayerNumber = 1 | 2;

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type DicePowerName = 'bomba' | 'rayo' | 'diagonal' | 'resurreccion';

export type DiceResult = {
  power: DicePowerName;
  affected: Array<{ row: number; col: number }>;
};

export type Move = {
  player: PlayerNumber;
  rowIndex: number;
  startIndex: number;
  count: number;
  timestamp: string;
  fromDice?: boolean;
};

export type GameState = {
  gameId: string;
  gameCode: string;
  inviteVersion: number;
  inviteToken: string;
  numRows: number;
  /**
   * Cada fila es un array de celdas:
   * 1 = canica presente, 0 = hueco.
   */
  rows: number[][];
  status: GameStatus;
  currentTurn: PlayerNumber;
  forcedRowIndex: number | null;
  turnDieValue: number | null;
  lastTouchedRowIndex: number | null;
  winner: PlayerNumber | null;
  yourPlayerNumber: PlayerNumber | null;
  yourDiceAvailable: boolean;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  moveHistory: Move[];
};

export type RankingEntry = {
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
  games: number;
  winRate: string;
  score: number;
};
