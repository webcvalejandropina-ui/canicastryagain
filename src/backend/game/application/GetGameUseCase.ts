import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { AppError } from '@/backend/shared/domain/AppError';

export class GetGameUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: { gameId: string; requesterPlayerId: string }): Promise<GameView> {
    const game = await this.gameRepository.getById(input.gameId);
    if (!game) {
      throw new AppError('Partida no encontrada', 404, 'GAME_NOT_FOUND');
    }

    if (!game.getPlayerNumber(input.requesterPlayerId)) {
      throw new AppError('Jugador no pertenece a esta partida', 403, 'PLAYER_NOT_IN_GAME');
    }
    return toGameView(game, input.requesterPlayerId);
  }
}
