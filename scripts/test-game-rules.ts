import assert from "node:assert/strict";
import { DICE_POWER_NAMES } from "../src/backend/game/domain/DicePowers";

import { Game } from "../src/backend/game/domain/Game";
import type {
  DicePowerName,
  PlayerNumber,
} from "../src/backend/game/domain/types";

function createPlayableGame(): Game {
  const game = Game.create({
    id: "game-test",
    code: "ABC123",
    numRows: 3,
    creator: { id: "p1", name: "Jugador 1" },
  });
  game.join({ id: "p2", name: "Jugador 2" });
  return game;
}

function testLastMarbleLoses(): void {
  const game = createPlayableGame();

  const sequence: Array<{
    playerId: string;
    rowIndex: number;
    startIndex: number;
    removeCount: number;
  }> = [
    { playerId: "p1", rowIndex: 2, startIndex: 0, removeCount: 1 },
    { playerId: "p2", rowIndex: 2, startIndex: 1, removeCount: 1 },
    { playerId: "p1", rowIndex: 2, startIndex: 2, removeCount: 1 },
    { playerId: "p2", rowIndex: 1, startIndex: 0, removeCount: 1 },
    { playerId: "p1", rowIndex: 1, startIndex: 1, removeCount: 1 },
    { playerId: "p2", rowIndex: 0, startIndex: 0, removeCount: 1 },
  ];

  for (let i = 0; i < sequence.length; i += 1) {
    const result = game.makeMove(sequence[i]);
    if (i < sequence.length - 1) {
      assert.equal(
        result.gameOver,
        false,
        `La partida no debe terminar antes del último movimiento (paso ${i + 1})`,
      );
    } else {
      assert.equal(
        result.gameOver,
        true,
        "La partida debe terminar al quitar la última canica",
      );
      assert.equal(
        result.winner,
        1,
        "El jugador que quita la última canica pierde",
      );
    }
  }
}

function testNoPrematureFinishWithIsolatedMarbles(): void {
  const game = createPlayableGame();

  const first = game.makeMove({
    playerId: "p1",
    rowIndex: 2,
    startIndex: 1,
    removeCount: 1,
  });
  assert.equal(
    first.gameOver,
    false,
    "No debe terminar al crear canicas aisladas",
  );

  const second = game.makeMove({
    playerId: "p2",
    rowIndex: 1,
    startIndex: 0,
    removeCount: 1,
  });
  assert.equal(
    second.gameOver,
    false,
    "No debe terminar aunque todas las canicas restantes estén aisladas",
  );

  const third = game.makeMove({
    playerId: "p1",
    rowIndex: 0,
    startIndex: 0,
    removeCount: 1,
  });
  assert.equal(
    third.gameOver,
    false,
    "Debe permitir continuar hasta que se retire la última canica",
  );
}

function withPower<T>(power: DicePowerName, action: () => T): T {
  const powers = DICE_POWER_NAMES;
  const original = Math.random;
  let first = true;
  Math.random = () => {
    if (!first) return 0;
    first = false;
    return powers.indexOf(power) / powers.length + 0.01;
  };
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

function gameWithRows(rows: number[][], currentTurn: PlayerNumber): Game {
  const state = createPlayableGame().toPrimitives();
  return Game.rehydrate({
    ...state,
    rows: rows.map((row) => [...row]),
    currentTurn,
  });
}

function remaining(game: Game): number {
  return game
    .toPrimitives()
    .rows.flat()
    .filter((cell) => cell === 1).length;
}

function testEveryRemovalLosesOnTheLastMarble(): void {
  for (const actor of [1, 2] as const) {
    const winner = actor === 1 ? 2 : 1;
    const rows = [[1], [0, 0], [0, 0, 0]];
    const normal = gameWithRows(rows, actor);
    const result = normal.makeMove({
      playerId: `p${actor}`,
      rowIndex: 0,
      startIndex: 0,
      removeCount: 1,
    });
    assert.deepEqual(result, { gameOver: true, winner });
    for (const power of ["bomba", "rayo", "diagonal"] as const) {
      const game = gameWithRows(rows, actor);
      const end = withPower(power, () => game.useDice(`p${actor}`));
      assert.equal(
        end.gameOver,
        true,
        `${power}: retirar la última termina la partida`,
      );
      assert.equal(
        end.winner,
        winner,
        `${power}: pierde quien usa el dado que retira la última`,
      );
      assert.equal(remaining(game), 0);
      assert.equal(game.status, "finished");
      assert.equal(game.hasDiceAvailable(actor), false);
      assert.throws(
        () => game.useDice(`p${winner}`),
        /no está en curso/,
        "No se puede resucitar después del final",
      );
    }
  }
}

function testDiceLeavingOneContinuesAndAllowsResurrection(): void {
  const scenarios: Array<{ power: DicePowerName; rows: number[][] }> = [
    { power: "bomba", rows: [[1], [1, 0], [0, 0, 0]] },
    { power: "rayo", rows: [[0], [1, 1], [0, 0, 0]] },
    { power: "diagonal", rows: [[1], [0, 0], [0, 1, 0]] },
  ];
  for (const actor of [1, 2] as const) {
    const rival = actor === 1 ? 2 : 1;
    for (const { power, rows } of scenarios) {
      const spentState = gameWithRows(rows, actor).toPrimitives();
      if (rival === 1) spentState.player1DiceUsed = true;
      else spentState.player2DiceUsed = true;
      const spentGame = Game.rehydrate(spentState);
      const spentResult = withPower(power, () =>
        spentGame.useDice(`p${actor}`),
      );
      assert.equal(
        spentResult.gameOver,
        false,
        "La última retirada se juega también si el rival ya gastó su dado",
      );
      assert.equal(spentGame.toPrimitives().currentTurn, rival);

      const game = gameWithRows(rows, actor);
      const result = withPower(power, () => game.useDice(`p${actor}`));
      assert.equal(remaining(game), 1);
      assert.equal(
        result.gameOver,
        false,
        `${power}: dejar una canica no es una victoria automática`,
      );
      assert.equal(result.winner, null);
      const state = game.toPrimitives();
      assert.equal(state.status, "playing");
      assert.equal(state.currentTurn, rival);
      assert.equal(state.moveHistory.length, 1);
      assert.equal(state.moveHistory[0].dice?.power, power);

      // The same position remains playable after persistence/reload.
      const normalReply = Game.rehydrate(structuredClone(state));
      const rowIndex = state.rows.findIndex((row) => row.includes(1));
      const last = normalReply.makeMove({
        playerId: `p${rival}`,
        rowIndex,
        startIndex: state.rows[rowIndex].indexOf(1),
        removeCount: 1,
      });
      assert.deepEqual(last, { gameOver: true, winner: actor });

      const revivalReply = Game.rehydrate(structuredClone(state));
      const revival = withPower("resurreccion", () =>
        revivalReply.useDice(`p${rival}`),
      );
      assert.ok(revival.dice.affected.length > 0);
      assert.ok(remaining(revivalReply) > 1);
      assert.equal(revival.gameOver, false);
      assert.equal(revival.winner, null);
      assert.equal(revivalReply.toPrimitives().currentTurn, actor);
      assert.equal(revivalReply.hasDiceAvailable(actor), false);
      assert.equal(revivalReply.hasDiceAvailable(rival), false);
    }
  }
}

function testNormalMoveLeavingOneAlsoAllowsResurrection(): void {
  const game = gameWithRows([[1], [1, 0], [0, 0, 0]], 1);
  assert.deepEqual(
    game.makeMove({
      playerId: "p1",
      rowIndex: 0,
      startIndex: 0,
      removeCount: 1,
    }),
    { gameOver: false, winner: null },
  );
  assert.equal(remaining(game), 1);
  const result = withPower("resurreccion", () => game.useDice("p2"));
  assert.equal(result.gameOver, false);
  assert.equal(result.winner, null);
  assert.equal(remaining(game), 2);
}

function testPowerWithoutTargetsStillPassesTheTurn(): void {
  const game = createPlayableGame();
  const result = withPower("resurreccion", () => game.useDice("p1"));
  assert.deepEqual(result.dice.affected, []);
  assert.equal(result.gameOver, false);
  assert.equal(result.winner, null);
  assert.equal(remaining(game), 6);
  assert.equal(game.toPrimitives().currentTurn, 2);
  assert.equal(game.hasDiceAvailable(1), false);
}

function testRandomResurrectionAcrossTheBoard():void {
  const rows=[[0],[0,1],[0,1,0]],dead=rows.flat().filter(c=>!c).length;
  for(let count=1;count<=dead;count++) {
    const g=gameWithRows(rows,1),original=Math.random;let first=true;
    try {
      Math.random=()=>{if(first){first=false;return (count-.5)/dead;}return .999;};
      const result=g.useDice('p1',()=>.4);
      assert.equal(result.dice.affected.length,count,'Every count from one to all is possible');
      assert.equal(new Set(result.dice.affected.map(c=>`${c.row}:${c.col}`)).size,count);
      assert.equal(remaining(g),rows.flat().filter(Boolean).length+count);
      assert.equal(g.toPrimitives().moveHistory.length,1);
      assert.equal(g.toPrimitives().currentTurn,2);
      assert.ok(result.dice.affected.every(c=>rows[c.row][c.col]===0),'Live cells are never picked');
      if(count===dead)assert.deepEqual(g.toPrimitives().rows,[[1],[1,1],[1,1,1]]);
      if(count>=2)assert.ok(new Set(result.dice.affected.map(c=>c.row)).size>1,'Can revive across different rows');
    } finally{Math.random=original;}
  }
}

function run(): void {
  testRandomResurrectionAcrossTheBoard();
  testLastMarbleLoses();
  testNoPrematureFinishWithIsolatedMarbles();
  testEveryRemovalLosesOnTheLastMarble();
  testDiceLeavingOneContinuesAndAllowsResurrection();
  testNormalMoveLeavingOneAlsoAllowsResurrection();
  testPowerWithoutTargetsStillPassesTheTurn();
  console.log(
    "OK: final misère unificado, ambos jugadores, tres poderes de retirada y Resurrección con una canica",
  );
}

run();
