import { Game } from '@/backend/game/domain/Game';
import { PlayerNumber } from '@/backend/game/domain/types';
import { encodeInviteToken } from '@/backend/game/application/InviteToken';

export type GameView = {
  gameId: string;
  gameCode: string;
  inviteVersion: number;
  inviteToken: string;
  numRows: number;
  rows: number[][];
  status: 'waiting' | 'playing' | 'finished';
  currentTurn: PlayerNumber;
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
  }[];
};

export function toGameView(game: Game, requesterPlayerId: string): GameView {
  const state = game.toPrimitives();

  return {
    gameId: state.id,
    gameCode: state.code,
    inviteVersion: state.inviteVersion,
    inviteToken: encodeInviteToken(state.code, state.inviteVersion),
    numRows: state.numRows,
    rows: state.rows,
    status: state.status,
    currentTurn: state.currentTurn,
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
