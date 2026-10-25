import { Game } from "@/backend/game/domain/Game";
import type { GameState } from "@/features/game/types";

export const DEMO_YOU = "demo-you";
export const DEMO_BOT = "demo-bot";

export function createDemoGame(numRows = 7): Game {
  const game = Game.create({ id: "local-demo", code: "DEMO", numRows, creator: { id: DEMO_YOU, name: "Tú" } });
  game.join({ id: DEMO_BOT, name: "Rival de práctica" });
  return game;
}

/** Reuses the real domain rules, with no repository, session or ranking writes. */
export function demoView(game: Game): GameState {
  const s = game.toPrimitives();
  return { gameId: s.id, gameCode: s.code, inviteVersion: 1, inviteToken: "", numRows: s.numRows,
    rows: s.rows.map(row => [...row]), status: s.status, currentTurn: s.currentTurn,
    forcedRowIndex: s.forcedRowIndex, turnDieValue: s.turnDieValue, lastTouchedRowIndex: s.lastTouchedRowIndex,
    pendingTargetPower:s.pendingTargetPower??null, pendingAncientShot: Boolean(s.pendingAncientShot), winner: s.winner, yourPlayerNumber: 1, yourDiceAvailable: game.hasDiceAvailable(1),
    player1: s.player1, player2: s.player2, moveHistory: s.moveHistory };
}

export function playDemoBot(game: Game): void {
  const s = game.toPrimitives();
  if (s.status !== "playing" || s.currentTurn !== 2) return;
  const total = s.rows.flat().filter(Boolean).length;
  // Show the rival's power during a real turn, without a second rules implementation.
  if (game.hasDiceAvailable(2) && s.moveHistory.length >= 3 && total > 7) {
    const result=game.useDice(DEMO_BOT);
    if(result.dice.pending) playDemoAncientShot(game,DEMO_BOT);
    return;
  }
  const moves: Array<{rowIndex: number; startIndex: number; removeCount: number}> = [];
  s.rows.forEach((row, rowIndex) => row.forEach((cell, startIndex) => {
    if (!cell) return;
    for (let count = 1; count <= s.moveHistory.length + 1 && row[startIndex + count - 1] === 1; count++)
      moves.push({rowIndex, startIndex, removeCount: count});
  }));
  const safe = moves.filter(move => move.removeCount < total);
  const candidates = safe.length ? safe : moves;
  const move = candidates[Math.floor(Math.random() * candidates.length)];
  if (move) game.makeMove({playerId: DEMO_BOT, ...move});
}

/** Automatic aim exists only for the practice bot and automated demo tests. */
export function playDemoAncientShot(game:Game,playerId:string):void {
  const rows=game.toPrimitives().rows;
  let row=rows.length-1;
  while(row>0&&!rows[row].some(Boolean))row--;
  const col=rows[row].indexOf(1);
  if(game.toPrimitives().pendingTargetPower){game.resolveDiceTarget(playerId,{row,col});return;}
  game.launchAncientShot(playerId,{row,col,dx:rows.length+1,dy:0});
}
