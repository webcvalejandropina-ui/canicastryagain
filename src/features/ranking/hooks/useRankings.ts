'use client';

import { useCallback, useMemo, useState } from 'react';

import { getRankings } from '@/features/game/api/gameApi';
import { RankingEntry } from '@/features/game/types';

export function useRankings(): {
  rankings: RankingEntry[];
  loading: boolean;
  error: string | null;
  fetchRankings: () => Promise<void>;
} {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await getRankings();
      setRankings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el ranking');
    } finally {
      setLoading(false);
    }
  }, []);

  return useMemo(
    () => ({
      rankings,
      loading,
      error,
      fetchRankings
    }),
    [rankings, loading, error, fetchRankings]
  );
}
