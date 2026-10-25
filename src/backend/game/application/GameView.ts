import { Game } from '@/backend/game/domain/Game';
import { DiceResult, PlayerNumber } from '@/backend/game/domain/types';
import { encodeInviteToken } from '@/backend/game/application/InviteToken';

export type GameView = {
  revision: number;
  gameId: string;
  gameCode: string;
  inviteVersion: number;
  inviteToken: string;
  privateInvitation?: boolean;
  invitationExpiresAt?: string | null;
  numRows: number;
  rows: number[][];
  status: 'waiting' | 'playing' | 'finished';
  currentTurn: PlayerNumber;
  pendingAncientShot: boolean;
  pendingTargetPower?: import("../domain/DicePowers").TargetPower | null;
  forcedRowIndex: number | null;
  turnDieValue: number | null;
  lastTouchedRowIndex: number | null;
  winner: PlayerNumber | null;
  yourPlayerNumber: PlayerNumber | null;
  yourDiceAvailable: boolean;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  moveHistory: {
    player: PlayerNumber;
    rowIndex: number;
    startIndex: number;
    count: number;
    timestamp: string;
    fromDice?: boolean;
    dice?: DiceResult;
  }[];
};

export function toGameView(game: Game, requesterPlayerId: string): GameView {
  const state = game.toPrimitives();

  return {
    revision: game.revision,
    gameId: state.id,
    gameCode: state.code,
    inviteVersion: state.inviteVersion,
    inviteToken: state.privateInviteToken
      ? (state.status === 'waiting' && state.player1?.id === requesterPlayerId ? state.privateInviteToken : '')
      : encodeInviteToken(state.code, state.inviteVersion),
    privateInvitation: Boolean(state.privateInviteToken),
    invitationExpiresAt: state.privateInviteExpiresAt ?? null,
    numRows: state.numRows,
    rows: state.rows,
    status: state.status,
    currentTurn: state.currentTurn,
    pendingAncientShot: Boolean(state.pendingAncientShot),
    pendingTargetPower: state.pendingTargetPower??null,
    forcedRowIndex: state.forcedRowIndex,
    turnDieValue: state.turnDieValue,
    lastTouchedRowIndex: state.lastTouchedRowIndex,
    winner: state.winner,
    yourPlayerNumber: game.getPlayerNumber(requesterPlayerId),
    yourDiceAvailable: (() => {
      const pn = game.getPlayerNumber(requesterPlayerId);
      return pn !== null ? game.hasDiceAvailable(pn) : false;
    })(),
    player1: state.player1,
    player2: state.player2,
    moveHistory: state.moveHistory
  };
}
