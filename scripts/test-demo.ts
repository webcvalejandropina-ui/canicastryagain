import assert from "node:assert/strict";
import { createDemoGame, demoView, playDemoBot, playDemoAncientShot, DEMO_YOU } from "../src/features/demo/demoEngine";

for (let trial = 0; trial < 100; trial++) {
  const game = createDemoGame();
  assert.equal(demoView(game).status, "playing");
  let turns = 0;
  while (game.status === "playing" && turns++ < 80) {
    const view = demoView(game);
    if (view.currentTurn === 2) playDemoBot(game);
    else if (view.yourDiceAvailable && view.moveHistory.length >= 2) {
      const result=game.useDice(DEMO_YOU);
      if(result.dice.pending)playDemoAncientShot(game,DEMO_YOU);
    }
    else {
      const rowIndex = view.rows.findIndex(row => row.some(Boolean));
      const startIndex = view.rows[rowIndex].indexOf(1);
      let removeCount = 1;
      while (removeCount < view.moveHistory.length + 1 && view.rows[rowIndex][startIndex + removeCount] === 1) removeCount++;
      game.makeMove({playerId: DEMO_YOU, rowIndex, startIndex, removeCount});
    }
    const after = demoView(game);
    assert.equal(after.moveHistory.length, view.moveHistory.length + 1, "One action per turn");
    assert.notEqual(after.rows, view.rows, "Views keep independent row snapshots");
  }
  const final = demoView(game);
  assert.equal(final.status, "finished", "Bot reaches a result");
  assert.equal(final.rows.flat().filter(Boolean).length, 0);
  assert.notEqual(final.winner, final.moveHistory.at(-1)?.player, "Last marble loses");
  assert.ok(final.moveHistory.filter(move => move.player === 2 && move.fromDice).length <= 1);
}
console.log("OK: 100 complete demo games; legal bot moves, powers, stable snapshots and misère ending");
