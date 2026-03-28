import { randomUUID } from 'node:crypto';

import { Game } from '@/backend/game/domain/Game';
import { generateRandomGameCode } from '@/backend/game/domain/GameCode';
import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';
import { AppError } from '@/backend/shared/domain/AppError';

const MAX_ROWS = 50;
const WAITING_GAME_TTL_MS = 5 * 60 * 1000;

const MIN_ROWS = 3;

function normalizeRows(numRows: number): number {
  const normalized = Number.isFinite(numRows) ? Math.floor(numRows) : 7;
  if (normalized < MIN_ROWS) {
    throw new AppError(`El mínimo de filas es ${MIN_ROWS}`, 400, 'ROWS_BELOW_MINIMUM');
  }
  if (normalized > MAX_ROWS) {
    throw new AppError(`El límite máximo es de ${MAX_ROWS} filas`, 400, 'ROWS_LIMIT_EXCEEDED');
  }
  return normalized;
}

function normalizePlayerName(playerName: string): string {
  const normalized = playerName.trim();
  if (!normalized) {
    throw new AppError('El nombre del jugador es obligatorio', 400, 'PLAYER_NAME_REQUIRED');
  }
  return normalized.slice(0, 32);
}

export class CreateGameUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: { playerId: string; playerName: string; numRows: number }): Promise<GameView> {
    const playerId = input.playerId.trim();
    if (!playerId) {
      throw new AppError('playerId es obligatorio', 400, 'PLAYER_ID_REQUIRED');
    }

    const rows = normalizeRows(input.numRows);
    const playerName = normalizePlayerName(input.playerName);
    const cutoffIso = new Date(Date.now() - WAITING_GAME_TTL_MS).toISOString();
    await this.gameRepository.deleteExpiredWaitingGames(cutoffIso);

    const gameCode = await this.generateUniqueCode();
    const game = Game.create({
      id: randomUUID(),
      code: gameCode,
      numRows: rows,
      creator: {
        id: playerId,
        name: playerName
      }
    });

    await this.gameRepository.save(game);
    publishGameUpdated(game.id, 'create');

    return toGameView(game, playerId);
  }

  private async generateUniqueCode(): Promise<string> {
    let attempts = 0;
    while (attempts < 30) {
      const candidate = generateRandomGameCode();
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.gameRepository.getByCode(candidate);
      if (!existing) {
        return candidate;
      }
      attempts += 1;
    }

    throw new AppError('No se pudo generar un código de partida único', 500, 'GAME_CODE_COLLISION');
  }
}
