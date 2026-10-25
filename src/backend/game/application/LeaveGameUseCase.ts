import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';
import { RankingRepository } from '@/backend/ranking/domain/RankingRepository';
import { AppError } from '@/backend/shared/domain/AppError';

export class LeaveGameUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly rankingRepository: RankingRepository
  ) {}

  async execute(input: { gameId: string; playerId: string }): Promise<GameView> {
    const game = await this.gameRepository.getById(input.gameId);
    if (!game) {
      throw new AppError('Partida no encontrada', 404, 'GAME_NOT_FOUND');
    }

    if (game.status === 'finished') {
      if (game.getPlayerNumber(input.playerId) === null) {
        throw new AppError('No perteneces a esta partida', 403, 'PLAYER_NOT_IN_GAME');
      }
      return toGameView(game, input.playerId);
    }

    const result = game.leave(input.playerId);

    if (result.gameWasPlayable) {
      // Keep the final snapshot available to the other player and to reconnecting phones.
      await this.gameRepository.save(game);
    } else {
      await this.gameRepository.deleteById(game.id);
    }

    if (result.gameWasPlayable && result.winner) {
      const winner = result.winner === 1 ? game.player1 : game.player2;
      const loser = result.winner === 1 ? game.player2 : game.player1;

      if (winner && loser) {
        await this.rankingRepository.recordMatchResult({
          winnerId: winner.id,
          winnerName: winner.name,
          loserId: loser.id,
          loserName: loser.name,
          outcome: 'abandon'
        });
      }
    }

    publishGameUpdated(game.id, 'leave', result.gameWasPlayable ? game : undefined);

    return toGameView(game, input.playerId);
  }
}
