'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiRequestError, createGame, getGame, joinGame, leaveGame, makeMove, rollDice } from '@/features/game/api/gameApi';
import { DiceResult, GameState } from '@/features/game/types';

const WAITING_SYNC_INTERVAL_MS = 3_000;
const PLAYING_SYNC_INTERVAL_MS = 4_000;
const HIDDEN_SYNC_INTERVAL_MS = 15_000;
const LIVE_CHANNEL_FALLBACK_MS = 30_000;
const LIVE_HEALTH_STALE_MS = 18_000;
const FOCUS_SYNC_STALE_MS = 5_000;

function getSyncInterval(gameStatus: GameState['status'] | undefined, hasLiveChannel: boolean): number {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return HIDDEN_SYNC_INTERVAL_MS;
  }
  if (hasLiveChannel) return LIVE_CHANNEL_FALLBACK_MS;
  if (gameStatus === 'waiting') return WAITING_SYNC_INTERVAL_MS;
  return PLAYING_SYNC_INTERVAL_MS;
}

export function useRemoteGame(playerId: string): {
  game: GameState | null;
  isBusy: boolean;
  isSyncing: boolean;
  hasLiveChannel: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  errorCode: string | null;
  clearError: () => void;
  clearGame: () => void;
  createNewGame: (input: { playerName: string; numRows: number }) => Promise<void>;
  joinExistingGame: (input: { playerName: string; gameCode?: string; inviteToken?: string }) => Promise<void>;
  leaveCurrentGame: () => Promise<void>;
  refreshGame: () => Promise<void>;
  sendMove: (rowIndex: number, startIndex: number, removeCount: number) => Promise<void>;
  sendDice: () => Promise<DiceResult | null>;
} {
  const [game, setGame] = useState<GameState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLiveChannel, setHasLiveChannel] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const syncInFlightRef = useRef(false);
  const lastSyncedAtRef = useRef<number>(0);

  const gameId = game?.gameId ?? null;
  const gameStatus = game?.status;
  const canSync = Boolean(gameId && playerId);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const clearGame = useCallback(() => {
    setGame(null);
    setLastSyncedAt(null);
    lastSyncedAtRef.current = 0;
  }, []);

  const markSynced = useCallback(() => {
    const now = Date.now();
    lastSyncedAtRef.current = now;
    setLastSyncedAt(now);
  }, []);

  const refreshGame = useCallback(async () => {
    if (!gameId || !playerId) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const latest = await getGame(gameId, playerId);
      setGame(latest);
      markSynced();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'GAME_NOT_FOUND') {
        setGame(null);
        setError('La partida dejó de estar disponible (caducó, se canceló o alguien salió).');
        setErrorCode('GAME_NOT_FOUND');
        return;
      }

      const message = err instanceof Error ? err.message : 'No se pudo sincronizar la partida';
      setError(message);
      setErrorCode(err instanceof ApiRequestError ? (err.code ?? null) : null);
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [gameId, playerId, markSynced]);

  useEffect(() => {
    if (!canSync) return;
    if (gameStatus === 'finished') return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let tickInFlight = false;

    const scheduleNext = (): void => {
      if (cancelled) return;
      if (timeoutId !== null) clearTimeout(timeoutId);
      const waitMs = getSyncInterval(gameStatus, hasLiveChannel);
      timeoutId = setTimeout(() => {
        if (!cancelled) void tick();
      }, waitMs);
    };

    const tick = async (): Promise<void> => {
      if (cancelled || tickInFlight) return;
      tickInFlight = true;
      await refreshGame();
      tickInFlight = false;
      scheduleNext();
    };

    const isStale = lastSyncedAtRef.current === 0 || Date.now() - lastSyncedAtRef.current > FOCUS_SYNC_STALE_MS;
    if (isStale) {
      void tick();
    } else {
      scheduleNext();
    }

    const onFocusOrVisible = (): void => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (tickInFlight || syncInFlightRef.current) return;
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = null;
      void tick();
    };

    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [canSync, gameStatus, hasLiveChannel, refreshGame]);

  useEffect(() => {
    if (!gameId || !playerId) {
      setHasLiveChannel(false);
      return;
    }
    if (gameStatus === 'finished') {
      setHasLiveChannel(false);
      return;
    }
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setHasLiveChannel(false);
      return;
    }

    const streamUrl = `/api/games/${encodeURIComponent(gameId)}/events?playerId=${encodeURIComponent(playerId)}`;
    const source = new EventSource(streamUrl);
    let disposed = false;
    let staleTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const parseEventPayload = (event: MessageEvent<string>): { game?: GameState; error?: string; code?: string } | null => {
      try {
        return JSON.parse(event.data) as { game?: GameState; error?: string; code?: string };
      } catch {
        return null;
      }
    };

    const applySnapshot = (payload: { game?: GameState } | null): boolean => {
      if (!payload?.game) return false;
      setGame(payload.game);
      markSynced();
      return true;
    };

    const scheduleStaleCheck = (): void => {
      if (disposed) return;
      if (staleTimeoutId !== null) clearTimeout(staleTimeoutId);
      staleTimeoutId = setTimeout(() => {
        if (!disposed) setHasLiveChannel(false);
      }, LIVE_HEALTH_STALE_MS);
    };

    const markLive = (): void => {
      if (disposed) return;
      setHasLiveChannel(true);
      scheduleStaleCheck();
    };

    const markDisconnected = (): void => {
      if (disposed) return;
      setHasLiveChannel(false);
      if (!syncInFlightRef.current) {
        void refreshGame();
      }
    };

    const onReady = (event: MessageEvent<string>): void => {
      markLive();
      const payload = parseEventPayload(event);
      if (applySnapshot(payload)) return;
      void refreshGame();
    };

    const onUpdate = (event: MessageEvent<string>): void => {
      markLive();
      const payload = parseEventPayload(event);
      if (applySnapshot(payload)) return;
      void refreshGame();
    };

    const onSyncError = (event: MessageEvent<string>): void => {
      const payload = parseEventPayload(event);
      if (!payload) return;

      if (payload.code === 'GAME_NOT_FOUND') {
        setGame(null);
      }
      if (payload.error) {
        setError(payload.error);
      }
      if (payload.code) {
        setErrorCode(payload.code);
      }
    };

    source.onopen = () => {
      markLive();
      if (!syncInFlightRef.current) {
        void refreshGame();
      }
    };
    source.onerror = markDisconnected;
    source.addEventListener('ready', onReady);
    source.addEventListener('update', onUpdate);
    source.addEventListener('sync-error', onSyncError);
    source.addEventListener('ping', markLive);

    return () => {
      disposed = true;
      setHasLiveChannel(false);
      if (staleTimeoutId !== null) clearTimeout(staleTimeoutId);
      source.close();
    };
  }, [gameId, playerId, gameStatus, refreshGame, markSynced]);

  const createNewGame = useCallback(
    async (input: { playerName: string; numRows: number }) => {
      setIsBusy(true);
      setError(null);
      setErrorCode(null);
      try {
        const created = await createGame({
          playerId,
          playerName: input.playerName,
          numRows: input.numRows
        });
        setGame(created);
        markSynced();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo crear la partida');
        setErrorCode(err instanceof ApiRequestError ? (err.code ?? null) : null);
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [playerId, markSynced]
  );

  const joinExistingGame = useCallback(
    async (input: { playerName: string; gameCode?: string; inviteToken?: string }) => {
      setIsBusy(true);
      setError(null);
      setErrorCode(null);
      try {
        const joined = await joinGame({
          playerId,
          playerName: input.playerName,
          gameCode: input.gameCode,
          inviteToken: input.inviteToken
        });
        setGame(joined);
        markSynced();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo unir a la partida');
        setErrorCode(err instanceof ApiRequestError ? (err.code ?? null) : null);
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [playerId, markSynced]
  );

  const sendMove = useCallback(
    async (rowIndex: number, startIndex: number, removeCount: number) => {
      if (!gameId) {
        setError('No hay partida activa');
        return;
      }

      setIsBusy(true);
      setError(null);
      setErrorCode(null);
      try {
        const updated = await makeMove({
          gameId,
          playerId,
          rowIndex,
          startIndex,
          removeCount
        });
        setGame(updated);
        markSynced();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo ejecutar el movimiento';
        setError(message);
        const errorCode = err instanceof ApiRequestError ? (err.code ?? null) : null;
        setErrorCode(errorCode);
        if (
          errorCode &&
          ['NOT_YOUR_TURN', 'GAME_NOT_PLAYING', 'TURN_LIMIT_EXCEEDED', 'OUT_OF_ROW_RANGE', 'NON_CONTIGUOUS_SELECTION'].includes(errorCode)
        ) {
          void refreshGame();
        }
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [gameId, playerId, markSynced, refreshGame]
  );

  const sendDice = useCallback(async (): Promise<DiceResult | null> => {
    if (!gameId) {
      setError('No hay partida activa');
      return null;
    }

    setIsBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      const result = await rollDice({ gameId, playerId });
      setGame(result.game);
      markSynced();
      return result.dice;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo usar el dado';
      setError(message);
      const errorCode = err instanceof ApiRequestError ? (err.code ?? null) : null;
      setErrorCode(errorCode);
      if (errorCode && ['NOT_YOUR_TURN', 'GAME_NOT_PLAYING'].includes(errorCode)) {
        void refreshGame();
      }
      throw err;
    } finally {
      setIsBusy(false);
    }
  }, [gameId, playerId, markSynced, refreshGame]);

  const leaveCurrentGame = useCallback(async () => {
    if (!gameId) {
      setError('No hay partida activa');
      return;
    }

    setIsBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      const updated = await leaveGame({
        gameId,
        playerId
      });
      setGame(updated);
      markSynced();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo salir de la partida';
      setError(message);
      setErrorCode(err instanceof ApiRequestError ? (err.code ?? null) : null);
      throw err;
    } finally {
      setIsBusy(false);
    }
  }, [gameId, playerId, markSynced]);

  return useMemo(
    () => ({
      game,
      isBusy,
      isSyncing,
      hasLiveChannel,
      lastSyncedAt,
      error,
      errorCode,
      clearError,
      clearGame,
      createNewGame,
      joinExistingGame,
      leaveCurrentGame,
      refreshGame,
      sendMove,
      sendDice
    }),
    [
      game,
      isBusy,
      isSyncing,
      hasLiveChannel,
      lastSyncedAt,
      error,
      errorCode,
      clearError,
      clearGame,
      createNewGame,
      joinExistingGame,
      leaveCurrentGame,
      refreshGame,
      sendMove,
      sendDice
    ]
  );
}
