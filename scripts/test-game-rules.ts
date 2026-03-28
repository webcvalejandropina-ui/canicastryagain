import assert from 'node:assert/strict';

import { Game } from '../src/backend/game/domain/Game';

function createPlayableGame(): Game {
  const game = Game.create({
    id: 'game-test',
    code: 'ABC123',
    numRows: 3,
    creator: { id: 'p1', name: 'Jugador 1' }
  });
  game.join({ id: 'p2', name: 'Jugador 2' });
  return game;
}

function testLastMarbleLoses(): void {
  const game = createPlayableGame();

  const sequence: Array<{ playerId: string; rowIndex: number; startIndex: number; removeCount: number }> = [
    { playerId: 'p1', rowIndex: 2, startIndex: 0, removeCount: 1 },
    { playerId: 'p2', rowIndex: 2, startIndex: 1, removeCount: 1 },
    { playerId: 'p1', rowIndex: 2, startIndex: 2, removeCount: 1 },
    { playerId: 'p2', rowIndex: 1, startIndex: 0, removeCount: 1 },
    { playerId: 'p1', rowIndex: 1, startIndex: 1, removeCount: 1 },
    { playerId: 'p2', rowIndex: 0, startIndex: 0, removeCount: 1 }
  ];

  for (let i = 0; i < sequence.length; i += 1) {
    const result = game.makeMove(sequence[i]);
    if (i < sequence.length - 1) {
      assert.equal(result.gameOver, false, `La partida no debe terminar antes del último movimiento (paso ${i + 1})`);
    } else {
      assert.equal(result.gameOver, true, 'La partida debe terminar al quitar la última canica');
      assert.equal(result.winner, 1, 'El jugador que quita la última canica pierde');
    }
  }
}

function testNoPrematureFinishWithIsolatedMarbles(): void {
  const game = createPlayableGame();

  const first = game.makeMove({ playerId: 'p1', rowIndex: 2, startIndex: 1, removeCount: 1 });
  assert.equal(first.gameOver, false, 'No debe terminar al crear canicas aisladas');

  const second = game.makeMove({ playerId: 'p2', rowIndex: 1, startIndex: 0, removeCount: 1 });
  assert.equal(second.gameOver, false, 'No debe terminar aunque todas las canicas restantes estén aisladas');

  const third = game.makeMove({ playerId: 'p1', rowIndex: 0, startIndex: 0, removeCount: 1 });
  assert.equal(third.gameOver, false, 'Debe permitir continuar hasta que se retire la última canica');
}

function run(): void {
  testLastMarbleLoses();
  testNoPrematureFinishWithIsolatedMarbles();
  console.log('OK: reglas misere consolidadas');
}

run();
