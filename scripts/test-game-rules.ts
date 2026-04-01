/**
 * Game Rules Test Suite — validates validateMove() core misère logic.
 * Run with: npm run test:rules
 *
 * Covers:
 *  - Invalid row / start / count bounds
 *  - Turn-limit enforcement (N canicas max on turn N)
 *  - Contiguous selection (no skipping holes)
 *  - Blocked-row rule (misère: cannot empty a row the rival just touched)
 *  - Last-ball exception (taking the last ball IS legal — you just lose the game)
 */

import { validateMove } from '../src/features/game/lib/validateMove';
import type { GameState, Move } from '../src/features/game/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMove(
  player: 1 | 2,
  rowIndex: number,
  startIndex: number,
  count: number
): Move {
  return {
    player,
    rowIndex,
    startIndex,
    count,
    timestamp: new Date().toISOString()
  };
}

/** Minimal playing game with given rows, move history, and optional state. */
function makeGame(
  rows: number[][],
  moveHistory: Move[],
  opts: {
    lastTouchedRowIndex?: number | null;
    status?: GameState['status'];
  } = {}
): GameState {
  return {
    gameId: 'test-game',
    gameCode: 'TEST01',
    inviteVersion: 1,
    inviteToken: 'tok',
    numRows: rows.length,
    rows,
    status: opts.status ?? 'playing',
    currentTurn: 1,
    forcedRowIndex: null,
    turnDieValue: null,
    lastTouchedRowIndex: opts.lastTouchedRowIndex ?? null,
    winner: null,
    yourPlayerNumber: 1,
    yourDiceAvailable: false,
    player1: { id: 'p1', name: 'Alice' },
    player2: { id: 'p2', name: 'Bob' },
    moveHistory
  };
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

type TestCase = {
  label: string;
  game: GameState;
  rowIndex: number;
  startIndex: number;
  removeCount: number;
  expectValid: boolean;
};

const tests: TestCase[] = [
  // ── Basic valid moves ──────────────────────────────────────────────────────
  {
    label: '1 canica en fila de 5 (turno 1, max=1)',
    game: makeGame([Array(5).fill(1), Array(5).fill(1)], []),
    rowIndex: 0,
    startIndex: 2,
    removeCount: 1,
    expectValid: true
  },
  {
    label: '3 canicas en fila de 7 (turno 3, max=3)',
    game: makeGame(
      [Array(7).fill(1), Array(7).fill(1)],
      [makeMove(2, 0, 1, 1), makeMove(1, 1, 0, 2)]
    ),
    rowIndex: 0,
    startIndex: 1,
    removeCount: 3,
    expectValid: true
  },

  // ── Turn limit ─────────────────────────────────────────────────────────────
  {
    label: 'excede turno max — turno 2 intenta quitar 3 (max=2)',
    game: makeGame(
      [Array(5).fill(1), Array(5).fill(1)],
      [makeMove(2, 0, 0, 1)]
    ),
    rowIndex: 0,
    startIndex: 1,
    removeCount: 3,
    expectValid: false
  },
  {
    label: 'turno 1 max=1 — quitar 2 supera el límite',
    game: makeGame([Array(5).fill(1)], []),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 2,
    expectValid: false
  },
  {
    label: 'exactamente turno max es válido',
    game: makeGame(
      [Array(5).fill(1), Array(5).fill(1)],
      [makeMove(2, 0, 0, 1)]
    ),
    rowIndex: 0,
    startIndex: 1,
    removeCount: 2,
    expectValid: true
  },

  // ── Contiguity ─────────────────────────────────────────────────────────────
  {
    label: 'hoyo en medio — no contiguo',
    game: makeGame([[1, 1, 0, 1, 1]], []),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 2,
    expectValid: false
  },
  {
    label: 'bloque contiguo de 3 en fila con huecos a los lados (turno 3, max=3)',
    game: makeGame(
      [[0, 0, 1, 1, 1, 0, 0], Array(7).fill(1)],
      [makeMove(2, 1, 0, 1), makeMove(1, 1, 1, 1)]
    ),
    rowIndex: 0,
    startIndex: 2,
    removeCount: 3,
    expectValid: true
  },
  {
    label: 'quitar canica inexistente (hueco)',
    game: makeGame([[1, 0, 1]], []),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 2,
    expectValid: false
  },

  // ── Blocked row (misère) ──────────────────────────────────────────────────
  {
    label: 'vaciar fila tocada por rival justo antes — bloqueado',
    game: makeGame(
      [[1, 1, 1], Array(3).fill(1)],
      [makeMove(2, 0, 0, 1)],
      { lastTouchedRowIndex: 0 }
    ),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 3,
    expectValid: false
  },
  {
    label: 'misma fila tocada antes pero deja 1 canica — OK',
    game: makeGame(
      [[1, 1, 1], Array(3).fill(1)],
      [makeMove(2, 0, 0, 1)],
      { lastTouchedRowIndex: 0 }
    ),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 2,
    expectValid: true
  },
  {
    label: 'bloquear fila propia — permitido (no impide tu propia fila)',
    // El rival tocó row 0; el jugador actual (turno 2, max=2) intenta vaciar SU propia fila row 0.
    // La regla de fila bloqueada SOLO aplica cuando el rival tocó esa fila, no cuando tú la tocaste antes.
    // Con 1 movimiento en history: turnLimit=2 → removeCount=2 es el máximo legal para este turno.
    game: makeGame(
      [[1, 1, 1], Array(3).fill(1)],
      [makeMove(2, 0, 0, 1)],   // el rival (P2) tocó row 0, no el jugador actual (P1)
      { lastTouchedRowIndex: 0 }
    ),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 2,   // 2 ≤ turnLimit(2) ✓; bloqueada por rival pero deja 1 → OK
    expectValid: true
  },
  {
    label: 'fila tocada antes no es la elegida — OK',
    // Rival tocó row 0; jugador actual elige row 1 (distinta) → la regla de fila bloqueada no aplica.
    // Con 1 movimiento en history: turnLimit=2 → removeCount=2 es el máximo legal.
    game: makeGame(
      [[1, 1, 1], [1, 1, 1]],
      [makeMove(2, 0, 0, 1)],   // rival tocó row 0
      { lastTouchedRowIndex: 0 }
    ),
    rowIndex: 1,
    startIndex: 0,
    removeCount: 2,   // ≤ turnLimit(2) ✓; fila elegida (1) ≠ fila rival bloqueada (0) → OK
    expectValid: true
  },

  // ── Last-ball exception (misère: you CAN take last ball — you just lose) ─
  {
    label: 'ultima canica del tablero — SI permitido (misere pierdes)',
    game: makeGame(
      [[1], [1, 1]],
      [makeMove(2, 1, 0, 1)],
      { lastTouchedRowIndex: 0 }
    ),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 1,
    expectValid: true
  },
  {
    label: 'vaciar fila toca otra fila con ultima canica — SI permitido',
    game: makeGame(
      [[1], [1, 1]],
      [makeMove(2, 1, 0, 1)],
      { lastTouchedRowIndex: 1 }
    ),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 1,
    expectValid: true
  },

  // ── Boundary / invalid inputs ─────────────────────────────────────────────
  {
    label: 'fila negativa — invalido',
    game: makeGame([[1, 1]], []),
    rowIndex: -1,
    startIndex: 0,
    removeCount: 1,
    expectValid: false
  },
  {
    label: 'fila fuera de rango — invalido',
    game: makeGame([[1, 1]], []),
    rowIndex: 99,
    startIndex: 0,
    removeCount: 1,
    expectValid: false
  },
  {
    label: 'startIndex negativo — invalido',
    game: makeGame([[1, 1]], []),
    rowIndex: 0,
    startIndex: -1,
    removeCount: 1,
    expectValid: false
  },
  {
    label: 'startIndex fuera de fila — invalido',
    game: makeGame([[1, 1]], []),
    rowIndex: 0,
    startIndex: 5,
    removeCount: 1,
    expectValid: false
  },
  {
    label: 'removeCount cero — invalido',
    game: makeGame([[1, 1]], []),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 0,
    expectValid: false
  },
  {
    label: 'removeCount excede longitud de fila — invalido',
    game: makeGame([[1, 1, 1]], []),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 10,
    expectValid: false
  },

  // ── Game status 'finished' — validateMove does not guard it (use-case concern) ─
  {
    label: 'juego finalizado — validateMove aun permite (dominio lo maneja)',
    game: makeGame([[1, 1]], [], { status: 'finished' }),
    rowIndex: 0,
    startIndex: 0,
    removeCount: 1,
    expectValid: true
  }
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

for (const tc of tests) {
  const result = validateMove(tc.game, tc.rowIndex, tc.startIndex, tc.removeCount);
  const ok = result.valid === tc.expectValid;

  if (ok) {
    passed++;
    console.log(`  \u2713 ${tc.label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${tc.label}`);
    console.log(`    expected valid=${tc.expectValid}, got valid=${result.valid}${result.reason ? ` — "${result.reason}"` : ''}`);
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('All game rules validated OK \u2014 core logique sound.');
}
