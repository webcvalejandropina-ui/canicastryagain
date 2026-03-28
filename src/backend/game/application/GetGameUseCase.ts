import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { AppError } from '@/backend/shared/domain/AppError';

const WAITING_GAME_TTL_MS = 5 * 60 * 1000;

export class GetGameUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: { gameId: string; requesterPlayerId: string }): Promise<GameView> {
    const cutoffIso = new Date(Date.now() - WAITING_GAME_TTL_MS).toISOString();
    await this.gameRepository.deleteExpiredWaitingGames(cutoffIso);

    const game = await this.gameRepository.getById(input.gameId);
    if (!game) {
      throw new AppError('Partida no encontrada', 404, 'GAME_NOT_FOUND');
    }

    return toGameView(game, input.requesterPlayerId);
  }
}
