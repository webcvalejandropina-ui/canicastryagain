import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';
import { RankingRepository } from '@/backend/ranking/domain/RankingRepository';
import { DiceResult } from '@/backend/game/domain/types';
import { AppError } from '@/backend/shared/domain/AppError';

export class UseDiceUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly rankingRepository: RankingRepository
  ) {}

  async execute(input: {
    gameId: string;
    playerId: string;
  }): Promise<{ game: GameView; dice: DiceResult }> {
    const game = await this.gameRepository.getById(input.gameId);
    if (!game) {
      throw new AppError('Partida no encontrada', 404, 'GAME_NOT_FOUND');
    }

    const result = game.useDice(input.playerId);

    await this.gameRepository.save(game);
    publishGameUpdated(game.id, 'move');

    if (result.gameOver) {
      const winner = result.winner === 1 ? game.player1 : game.player2;
      const loser = result.winner === 1 ? game.player2 : game.player1;

      if (winner && loser) {
        await this.rankingRepository.recordMatchResult({
          winnerId: winner.id,
          winnerName: winner.name,
          loserId: loser.id,
          loserName: loser.name,
          outcome: 'victory'
        });
      }
    }

    return {
      game: toGameView(game, input.playerId),
      dice: result.dice
    };
  }
}
