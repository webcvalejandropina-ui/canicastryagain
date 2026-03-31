import { Game } from '../src/backend/game/domain/Game.js';

const g = Game.create({ id: 't', code: 'T', numRows: 3, creator: { id: 'p1', name: 'P1' } });
g.join({ id: 'p2', name: 'P2' });

const s = g.state as any;
console.log('Initial rows:', s.rows);

const r1 = g.makeMove({ playerId: 'p1', rowIndex: 2, startIndex: 0, removeCount: 1 });
console.log('After P1 move 1:', { gameOver: r1.gameOver, lastTouched: s.lastTouchedRowIndex, rows: s.rows });

const r2 = g.makeMove({ playerId: 'p2', rowIndex: 2, startIndex: 1, removeCount: 1 });
console.log('After P2 move 1:', { gameOver: r2.gameOver, lastTouched: s.lastTouchedRowIndex, rows: s.rows });

try {
  const r3 = g.makeMove({ playerId: 'p1', rowIndex: 2, startIndex: 2, removeCount: 1 });
  console.log('After P1 move 2:', { gameOver: r3.gameOver, lastTouched: s.lastTouchedRowIndex, rows: s.rows });
} catch (e: any) {
  console.log('P1 move 2 FAILED:', e.message, 'code:', e.code);
}
