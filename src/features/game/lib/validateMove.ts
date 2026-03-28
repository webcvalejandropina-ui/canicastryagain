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

  return { valid: true };
}
