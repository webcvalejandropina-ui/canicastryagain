import assert from "node:assert/strict";
import { rowsAtMove } from "../src/features/game/lib/replay";
import { isCelebrationDay } from "../src/features/appearance/appearance";
import type { Move } from "../src/features/game/types";
const moves: Move[] = [
  { player: 1, rowIndex: 2, startIndex: 1, count: 1, timestamp: "a" },
  {
    player: 2,
    rowIndex: 0,
    startIndex: 0,
    count: 0,
    timestamp: "b",
    fromDice: true,
    dice: {
      power: "bomba",
      affected: [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    },
  },
  {
    player: 1,
    rowIndex: 0,
    startIndex: 0,
    count: 0,
    timestamp: "c",
    fromDice: true,
    dice: {
      power: "resurreccion",
      affected: [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    },
  },
];
assert.deepEqual(rowsAtMove(3, moves, -1), [[1], [1, 1], [1, 1, 1]]);
assert.deepEqual(rowsAtMove(3, moves, 0), [[1], [1, 1], [1, 0, 1]]);
assert.deepEqual(rowsAtMove(3, moves, 1), [[1], [0, 0], [1, 0, 1]]);
assert.deepEqual(rowsAtMove(3, moves, 2), [[1], [1, 1], [1, 0, 1]]);
const view = rowsAtMove(3, moves, 0);
view[0][0] = 0;
assert.equal(rowsAtMove(3, moves, 0)[0][0], 1);
assert.deepEqual(moves[1].dice?.affected, [
  { row: 1, col: 0 },
  { row: 1, col: 1 },
]);
assert.equal(isCelebrationDay("halloween", 10, 31), true);
assert.equal(isCelebrationDay("halloween", 10, 30), false);
assert.equal(isCelebrationDay("christmas", 12, 25), true);
assert.equal(isCelebrationDay("christmas", 1, 1), true);
assert.equal(isCelebrationDay("christmas", 1, 2), false);
assert.equal(isCelebrationDay("summer", 6, 21), true);
assert.equal(isCelebrationDay("none", 10, 31), false);
console.log(
  "OK: history replays normal moves, removal powers and resurrection without touching the live game; celebration dates verified",
);
