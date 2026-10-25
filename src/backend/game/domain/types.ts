import type { DicePowerName, TargetPower, DiceTarget, ShuffledRow } from '@/backend/game/domain/DicePowers';
export type { DicePowerName, TargetPower, DiceTarget } from '@/backend/game/domain/DicePowers';
import type { AncientShot, AncientFlight } from "@/backend/game/domain/AncientShot";
export type { AncientShot } from "@/backend/game/domain/AncientShot";
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
  dice?: DiceResult;
};



export type DiceResult = {
  power: DicePowerName;
  pending?: boolean;
  shot?: AncientShot;
  flight?: AncientFlight;
  target?: DiceTarget;
  shuffledRows?: ShuffledRow[];
  affected: Array<{ row: number; col: number }>;
};

export type GamePrimitives = {
  revision?: number;
  id: string;
  code: string;
  inviteVersion: number;
  privateInviteToken?: string | null;
  privateInviteExpiresAt?: string | null;
  numRows: number;
  /**
   * Representa cada fila como un array de celdas.
   * 1 = canica presente, 0 = hueco (canica eliminada).
   * La longitud de la fila N es N + 1.
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
  player1: PlayerSlot | null;
  player2: PlayerSlot | null;
  player1DiceUsed: boolean;
  player2DiceUsed: boolean;
  moveHistory: Move[];
  createdAt: string;
  updatedAt: string;
};
