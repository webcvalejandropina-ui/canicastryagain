import { RankingEntry } from '@/backend/ranking/domain/RankingEntry';
import { MatchOutcome } from '@/backend/ranking/domain/ScoringRules';

export type RecordMatchInput = {
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  outcome: MatchOutcome;
};

export interface RankingRepository {
  recordMatchResult(input: RecordMatchInput): Promise<void>;
  getPlayerStats(playerId: string): Promise<{ wins: number; games: number } | null>;
  getLeaderboard(limit?: number): Promise<RankingEntry[]>;
}
