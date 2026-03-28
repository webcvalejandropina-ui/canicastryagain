import { RankingEntry } from '@/backend/ranking/domain/RankingEntry';
import { RankingRepository } from '@/backend/ranking/domain/RankingRepository';

export class GetRankingsUseCase {
  constructor(private readonly rankingRepository: RankingRepository) {}

  async execute(limit = 50): Promise<RankingEntry[]> {
    return this.rankingRepository.getLeaderboard(limit);
  }
}
