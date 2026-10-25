import type { DicePowerName, TargetPower, DiceTarget, ShuffledRow } from '@/backend/game/domain/DicePowers';
export type { DicePowerName, TargetPower, DiceTarget } from '@/backend/game/domain/DicePowers';
import type { AncientShot, AncientFlight } from "@/backend/game/domain/AncientShot";
export type { AncientShot } from "@/backend/game/domain/AncientShot";
export type PlayerNumber = 1 | 2;

export type GameStatus = 'waiting' | 'playing' | 'finished';



export type DiceResult = {
  power: DicePowerName;
  pending?: boolean;
  shot?: AncientShot;
  flight?: AncientFlight;
  target?: DiceTarget;
  shuffledRows?: ShuffledRow[];
  affected: Array<{ row: number; col: number }>;
};

export type Move = {
  player: PlayerNumber;
  rowIndex: number;
  startIndex: number;
  count: number;
  timestamp: string;
  fromDice?: boolean;
  dice?: DiceResult;
};

export type GameState = {
  revision?: number;
  gameId: string;
  gameCode: string;
  inviteVersion: number;
  inviteToken: string;
  privateInvitation?: boolean;
  invitationExpiresAt?: string | null;
  numRows: number;
  /**
   * Cada fila es un array de celdas:
   * 1 = canica presente, 0 = hueco.
   */
  rows: number[][];
  status: GameStatus;
  currentTurn: PlayerNumber;
  pendingAncientShot?: boolean;
  pendingTargetPower?: TargetPower | null;
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
