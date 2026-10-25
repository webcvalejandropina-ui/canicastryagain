/** Shared by creation, invitations and the lobby. Existing tables retain their size. */
export const MIN_ROWS = 1;
export const MAX_ROWS = 100;
export const DEFAULT_ROWS = 7;
export const marbleCount = (rows: number): number => rows * (rows + 1) / 2;
export function validRowCount(rows: number): boolean {
  return Number.isInteger(rows) && rows >= MIN_ROWS && rows <= MAX_ROWS;
}
