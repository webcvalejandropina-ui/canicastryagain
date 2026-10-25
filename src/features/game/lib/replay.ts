import type { Move } from "../types";

/** Rebuild only the requested turn; never change the live game or its history. */
export function rowsAtMove(
  numRows: number,
  moves: Move[],
  through: number,
): number[][] {
  const rows = Array.from({ length: numRows }, (_, row) =>
    Array<number>(row + 1).fill(1),
  );
  for (let index = 0; index <= Math.min(through, moves.length - 1); index++) {
    const move = moves[index];
    if (move.fromDice && move.dice) {
      if(move.dice.shuffledRows) {
        for(const change of move.dice.shuffledRows) {
          const before=rows[change.row]?.slice();
          if(before&&change.order.length===before.length)rows[change.row]=change.order.map(from=>before[from]);
        }
        continue;
      }
      for (const { row, col } of move.dice.affected) {
        if (rows[row]?.[col] !== undefined)
          rows[row][col] = move.dice.power === "resurreccion" ? 1 : 0;
      }
    } else {
      for (
        let col = move.startIndex;
        col < move.startIndex + move.count;
        col++
      ) {
        if (rows[move.rowIndex]?.[col] !== undefined)
          rows[move.rowIndex][col] = 0;
      }
    }
  }
  return rows;
}
