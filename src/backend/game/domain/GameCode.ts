const GAME_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomGameCode(size = 6): string {
  let code = '';
  for (let i = 0; i < size; i += 1) {
    code += GAME_CODE_CHARS.charAt(Math.floor(Math.random() * GAME_CODE_CHARS.length));
  }
  return code;
}

export function normalizeGameCode(code: string): string {
  return code.trim().toUpperCase();
}
