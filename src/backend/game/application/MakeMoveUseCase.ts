import { GameRepository } from '@/backend/game/domain/GameRepository';
import { GameView, toGameView } from '@/backend/game/application/GameView';
import { publishGameUpdated } from '@/backend/game/infrastructure/GameEvents';
import { RankingRepository } from '@/backend/ranking/domain/RankingRepository';
import { AppError } from '@/backend/shared/domain/AppError';

export class MakeMoveUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly rankingRepository: RankingRepository
  ) {}

  async execute(input: {
    gameId: string;
    playerId: string;
    rowIndex: number;
    startIndex: number;
    removeCount: number;
  }): Promise<GameView> {
    const game = await this.gameRepository.getById(input.gameId);
    if (!game) {
      throw new AppError('Partida no encontrada', 404, 'GAME_NOT_FOUND');
    }

    const result = game.makeMove({
      playerId: input.playerId,
      rowIndex: input.rowIndex,
      startIndex: input.startIndex,
      removeCount: input.removeCount
    });

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

    return toGameView(game, input.playerId);
  }
}
