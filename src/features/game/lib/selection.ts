import type { MarbleSelection } from "../components/MatchBoard";

export function selectRange(
  rows: number[][],
  row: number,
  anchor: number,
  target: number,
  limit: number,
): MarbleSelection {
  const cells = rows[row];
  if (!cells || cells[anchor] !== 1 || limit < 1) return null;
  const direction = target < anchor ? -1 : 1;
  let end = anchor;
  for (let count = 1; count < limit && end !== target; count++) {
    const next = end + direction;
    if (cells[next] !== 1) break;
    end = next;
  }
  return {
    rowIndex: row,
    startIndex: Math.min(anchor, end),
    endIndex: Math.max(anchor, end),
  };
}

export function tapSelection(
  rows: number[][],
  previous: MarbleSelection,
  row: number,
  column: number,
  limit: number,
): MarbleSelection {
  if (!previous || previous.rowIndex !== row)
    return selectRange(rows, row, column, column, limit);
  if (column === previous.startIndex)
    return column === previous.endIndex
      ? null
      : { ...previous, startIndex: column + 1 };
  if (column === previous.endIndex)
    return { ...previous, endIndex: column - 1 };
  if (column > previous.startIndex && column < previous.endIndex)
    return previous;
  return selectRange(rows, row, previous.startIndex, column, limit);
}
