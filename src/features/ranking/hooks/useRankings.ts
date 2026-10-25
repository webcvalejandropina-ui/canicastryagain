'use client';

import { useCallback, useMemo, useState } from 'react';

import { ApiRequestError,getRankings } from '@/features/game/api/gameApi';
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
      setError(err instanceof ApiRequestError && ['NETWORK_ERROR','REQUEST_TIMEOUT'].includes(err.code??'')
        ? 'No se pudo actualizar la clasificación. Comprueba tu conexión.'
        : err instanceof Error ? err.message : 'No se pudo cargar la clasificación');
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
