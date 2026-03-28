import { RankingEntry } from '@/backend/ranking/domain/RankingEntry';
import { RankingRepository, RecordMatchInput } from '@/backend/ranking/domain/RankingRepository';
import { calculatePoints } from '@/backend/ranking/domain/ScoringRules';
import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

type RankingRow = {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  games: number;
  win_rate: number;
  score: number;
};

type StatsRow = { wins: number; games: number };

const getStatsStatement = sqlite.prepare(
  'SELECT wins, games FROM ranking_stats WHERE player_id = ?'
);

const upsertWinnerStatement = sqlite.prepare(`
  INSERT INTO ranking_stats (player_id, player_name, wins, losses, games, score, created_at, updated_at)
  VALUES (@player_id, @player_name, 1, 0, 1, @score, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(player_id) DO UPDATE SET
    player_name = excluded.player_name,
    wins = ranking_stats.wins + 1,
    games = ranking_stats.games + 1,
    score = ranking_stats.score + @score,
    updated_at = CURRENT_TIMESTAMP
`);

const upsertLoserStatement = sqlite.prepare(`
  INSERT INTO ranking_stats (player_id, player_name, wins, losses, games, score, created_at, updated_at)
  VALUES (@player_id, @player_name, 0, 1, 1, @score, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(player_id) DO UPDATE SET
    player_name = excluded.player_name,
    losses = ranking_stats.losses + 1,
    games = ranking_stats.games + 1,
    score = ranking_stats.score + @score,
    updated_at = CURRENT_TIMESTAMP
`);

const leaderboardStatement = sqlite.prepare(`
  SELECT
    player_id,
    player_name,
    wins,
    losses,
    games,
    score,
    CASE WHEN games > 0 THEN ROUND((wins * 100.0) / games, 1) ELSE 0 END as win_rate
  FROM ranking_stats
  ORDER BY score DESC, wins DESC, win_rate DESC, games DESC
  LIMIT ?
`);

export class SqliteRankingRepository implements RankingRepository {
  async getPlayerStats(playerId: string): Promise<StatsRow | null> {
    const row = getStatsStatement.get(playerId) as StatsRow | undefined;
    return row ?? null;
  }

  async recordMatchResult(input: RecordMatchInput): Promise<void> {
    const winnerStats = await this.getPlayerStats(input.winnerId);
    const loserStats = await this.getPlayerStats(input.loserId);

    const loserOutcome = input.outcome === 'abandon' ? 'abandon' : 'defeat';

    const winnerPoints = calculatePoints(
      'victory',
      winnerStats?.wins ?? 0,
      winnerStats?.games ?? 0,
      loserStats?.wins ?? 0,
      loserStats?.games ?? 0
    );

    const loserPoints = calculatePoints(
      loserOutcome,
      loserStats?.wins ?? 0,
      loserStats?.games ?? 0,
      winnerStats?.wins ?? 0,
      winnerStats?.games ?? 0
    );

    const transaction = sqlite.transaction(() => {
      upsertWinnerStatement.run({
        player_id: input.winnerId,
        player_name: input.winnerName,
        score: winnerPoints
      });

      upsertLoserStatement.run({
        player_id: input.loserId,
        player_name: input.loserName,
        score: loserPoints
      });
    });

    transaction();
  }

  async getLeaderboard(limit = 50): Promise<RankingEntry[]> {
    const rows = leaderboardStatement.all(limit) as RankingRow[];

    return rows.map((row) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      wins: row.wins,
      losses: row.losses,
      games: row.games,
      winRate: Number(row.win_rate).toFixed(1),
      score: row.score
    }));
  }
}
