import { GameState } from '@/features/game/types';

export function validateMove(
  game: GameState,
  rowIndex: number,
  startIndex: number,
  removeCount: number
): { valid: boolean; reason?: string } {
  if (rowIndex < 0 || rowIndex >= game.rows.length) {
    return { valid: false, reason: 'Fila inválida' };
  }

  if (removeCount < 1) {
    return { valid: false, reason: 'Debes quitar al menos 1 canica' };
  }

  if (!Number.isInteger(startIndex) || startIndex < 0) {
    return { valid: false, reason: 'Posición inicial inválida' };
  }

  const row = game.rows[rowIndex];
  if (startIndex >= row.length || startIndex + removeCount > row.length) {
    return { valid: false, reason: 'Rango fuera de la fila' };
  }

  const turnLimit = game.moveHistory.length + 1;
  if (removeCount > turnLimit) {
    return {
      valid: false,
      reason: `En el turno ${turnLimit} solo puedes quitar hasta ${turnLimit} canica${turnLimit > 1 ? 's' : ''}`
    };
  }

  // Todas las canicas seleccionadas deben existir y ser contiguas (sin huecos)
  for (let offset = 0; offset < removeCount; offset += 1) {
    const cellIndex = startIndex + offset;
    if (row[cellIndex] !== 1) {
      return { valid: false, reason: 'Solo puedes quitar canicas contiguas sin huecos' };
    }
  }

  // Regla de fila bloqueada (misère): no puedes vaciar una fila que el rival tocó en el turno anterior.
  // EXCEPCIÓN: si es la última canica del tablero, sí se puede (el que la toma pierde).
  const rowRemainingAfterMove = row.filter((c) => c === 1).length - removeCount;
  const totalBalls = game.rows.reduce(
    (sum, r) => sum + r.reduce((rowSum, cell) => rowSum + (cell === 1 ? 1 : 0), 0),
    0
  );
  const isLastBall = totalBalls === removeCount && rowRemainingAfterMove === 0;
  if (game.lastTouchedRowIndex === rowIndex && rowRemainingAfterMove === 0 && !isLastBall) {
    return {
      valid: false,
      reason: `No puedes vaciar la fila ${rowIndex + 1} porque el rival la tocó en el turno anterior. Debes dejar al menos 1 canica.`
    };
  }

  return { valid: true };
}
