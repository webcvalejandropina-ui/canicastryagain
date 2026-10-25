"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  createGame,
  getGame,
  joinGame,
  leaveGame,
  makeMove,
  rollDice,
  request,
} from "../api/gameApi";
import { newerSnapshot, reconnectDelay, type ConnectionState } from "../lib/synchronization";
import { applyGameDelta, type GameDelta } from "../lib/gameDelta";
import type { AncientShot, DiceResult, GameState } from "../types";

export type OpenGame = {gameId:string;gameCode:string;status:'waiting'|'playing';currentTurn:number;player1Id:string;player1Name:string;player2Name:string|null;updatedAt:string};
export function useRemoteGame(playerId: string) {
  const identity=useRef(playerId);identity.current=playerId;
  const [openGames,setOpenGames]=useState<OpenGame[]>([]);
  const refreshOpenGames=useCallback(async()=>{
    if(!playerId){setOpenGames([]);return;}
    try{const result=await request<{games:OpenGame[]}>('/api/games');if(identity.current===playerId)setOpenGames(result.games);}catch{/* Keep last known list during reconnect. */}
  },[playerId]);
  const [game, setGame] = useState<GameState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [streamEpoch, setStreamEpoch] = useState(0);
  const current = useRef<GameState | null>(null);
  const generation = useRef(0);
  const mutation = useRef(false);
  const refresh = useRef<Promise<void> | null>(null);
  const live = useRef(false);
  const lastSuccess = useRef(0);
  const reconnectAttempts = useRef(0);
  const gameId = game?.gameId;
  const status = game?.status;
  const unavailable = ["GAME_NOT_FOUND", "GAME_EXPIRED", "PLAYER_NOT_IN_GAME", "GAME_SESSION_REQUIRED"].includes(errorCode ?? "");

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);
  const fail = useCallback((problem: unknown) => {
    if(problem instanceof ApiRequestError && problem.code === 'GAME_EXPIRED') {
      current.current=null;setGame(null);setConnection('offline');
      try {localStorage.removeItem(`canicas-active-${playerId}`);}catch{/* Optional cache. */}
    }
    setError(
      problem instanceof Error
        ? problem.message
        : "No se pudo completar la operación.",
    );
    setErrorCode(
      problem instanceof ApiRequestError ? (problem.code ?? null) : null,
    );
  }, [playerId]);

  const apply = useCallback(
    (snapshot: GameState) => {
      const previous = current.current;
      const next = newerSnapshot(previous, snapshot);
      current.current = next;
      if (next !== previous && playerId) {
        try {
          localStorage.setItem(
            `canicas-active-${playerId}`,
            JSON.stringify(next),
          );
        } catch {
          /* Storage is optional; server state remains authoritative. */
        }
      }
      setGame((previous) => (previous === next ? previous : next));
      const now = Date.now();
      lastSuccess.current = now;
      setLastSyncedAt(now);
      setConnection(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : live.current
            ? "live"
            : "polling",
      );
    },
    [playerId],
  );

  const clearGame = useCallback(() => {
    try {
      localStorage.removeItem(`canicas-active-${playerId}`);
    } catch {
      /* Private storage may be unavailable. */
    }
    generation.current++;
    current.current = null;
    setGame(null);
    setLastSyncedAt(null);
    live.current = false;
    refresh.current = null;
    setConnection("connecting");
  }, [playerId]);

  const refreshGame = useCallback(async (): Promise<void> => {
    const target = current.current;
    if (!target || !playerId || unavailable) return;
    if (refresh.current) return refresh.current;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setConnection("offline");
      return;
    }
    const epoch = generation.current;
    const lastKnownSuccess = lastSuccess.current;
    const task = (async () => {
      setIsSyncing(true);
      try {
        const snapshot = await getGame(target.gameId, playerId, target);
        if (
          epoch === generation.current &&
          current.current?.gameId === target.gameId
        )
          apply(snapshot);
      } catch (problem) {
        if (
          epoch !== generation.current ||
          lastSuccess.current > lastKnownSuccess
        )
          return;
        live.current = false;
        setConnection(
          typeof navigator !== "undefined" && !navigator.onLine
            ? "offline"
            : "reconnecting",
        );
        // Transient failures are shown persistently in the connection UI, never in a toast loop.
        if (
          problem instanceof ApiRequestError &&
          ["GAME_NOT_FOUND", "GAME_EXPIRED", "PLAYER_NOT_IN_GAME", "GAME_SESSION_REQUIRED"].includes(problem.code ?? "")
        )
          fail(problem);
      } finally {
        if (epoch === generation.current) {
          setIsSyncing(false);
          refresh.current = null;
        }
      }
    })();
    refresh.current = task;
    return task;
  }, [playerId, apply, fail, unavailable]);

  // Invalidate outstanding responses when the account changes in the same tab.
  useEffect(() => {
    generation.current++;
    current.current = null;
    refresh.current = null;
    live.current = false;
    reconnectAttempts.current = 0;
    setGame(null);setOpenGames([]);
    clearError();
    const activeGeneration = generation;
    return () => { activeGeneration.current++; };
  }, [playerId, clearError]);

  useEffect(() => {
    if (
      !playerId ||
      new URLSearchParams(window.location.search).has("code") ||
      new URLSearchParams(window.location.search).has("inv") ||
      new URLSearchParams(window.location.hash.slice(1)).has("invite")
    )
      return;
    let cached: GameState;
    try {
      cached = JSON.parse(
        localStorage.getItem(`canicas-active-${playerId}`) ?? "null",
      ) as GameState;
      if (
        !cached ||
        typeof cached.gameId !== "string" ||
        !Array.isArray(cached.rows) ||
        (cached.player1?.id !== playerId && cached.player2?.id !== playerId)
      )
        return;
    } catch {
      return;
    }
    const epoch = generation.current;
    current.current = cached;
    setGame(cached);
    setConnection(navigator.onLine ? "connecting" : "offline");
    void getGame(cached.gameId, playerId)
      .then((snapshot) => {
        if (generation.current === epoch) apply(snapshot);
      })
      .catch((problem) => {
        if (generation.current !== epoch) return;
        if (
          problem instanceof ApiRequestError &&
          ["GAME_NOT_FOUND", "GAME_EXPIRED"].includes(problem.code ?? "")
        ) {
          try {
            localStorage.removeItem(`canicas-active-${playerId}`);
          } catch {
            /* Optional cache. */
          }
          current.current = null;
          setGame(null);
          if(problem.code === "GAME_EXPIRED")fail(problem);
        } else setConnection(navigator.onLine ? "reconnecting" : "offline");
      });
  }, [playerId, apply, fail]);

  useEffect(() => {
    if (!gameId || !playerId || status === "finished" || unavailable) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const tick = async () => {
      if (stopped) return;
      if (!live.current && navigator.onLine && document.visibilityState !== "hidden") {
        const before = lastSuccess.current;
        await refreshGame();
        failures = lastSuccess.current > before ? 0 : failures + 1;
      }
      if (!stopped) timer = setTimeout(() => void tick(), live.current ? 5000 : Math.max(2000, reconnectDelay(failures)));
    };
    timer = setTimeout(() => void tick(), 3000);
    const wake = () => {
      if (document.visibilityState === "hidden") {
        setStreamEpoch((value) => value + 1);
        return;
      }
      if (!navigator.onLine) {
        live.current = false;
        setConnection("offline");
        return;
      }
      if (live.current) return;
      failures = 0;
      reconnectAttempts.current = 0;
      // The stream's ready snapshot resynchronizes; fallback polling handles unsupported SSE.
      setStreamEpoch((value) => value + 1);
    };
    const offline = () => {
      setStreamEpoch((value) => value + 1);
      live.current = false;
      setConnection("offline");
    };
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [gameId, playerId, status, refreshGame, unavailable]);

  useEffect(() => {
    live.current = false;
    if (
      !gameId ||
      !playerId ||
      status === "finished" ||
      unavailable ||
      document.visibilityState === "hidden"
    )
      return;
    if (!navigator.onLine) {
      setConnection("offline");
      return;
    }
    if (typeof EventSource === "undefined") {
      setConnection("polling");
      return;
    }
    let disposed = false;
    let health: ReturnType<typeof setTimeout>;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource(
      `/api/games/${encodeURIComponent(gameId)}/events?playerId=${encodeURIComponent(playerId)}&updates=delta`,
    );
    const retry = () => {
      if (disposed || reconnect !== undefined) return;
      clearTimeout(health);
      source.close();
      live.current = false;
      setConnection(navigator.onLine ? "reconnecting" : "offline");
      if (navigator.onLine) {
        reconnect = setTimeout(() => {
          if (!disposed) setStreamEpoch((value) => value + 1);
        }, reconnectDelay(reconnectAttempts.current++));
      }
    };
    const healthy = () => {
      if (disposed) return;
      clearTimeout(health);
      reconnectAttempts.current = 0;
      live.current = true;
      setConnection("live");
      health = setTimeout(retry, 30000);
    };
    const snapshot = (event: MessageEvent<string>) => {
      if (disposed) return;
      try {
        const payload = JSON.parse(event.data) as { game?: GameState; delta?: GameDelta };
        if (payload.game) {
          if (payload.game.gameId !== gameId) return;
          healthy();
          apply(payload.game);
        } else if (payload.delta?.gameId === gameId) {
          const reconstructed = applyGameDelta(current.current, payload.delta);
          if (!reconstructed) { void refreshGame(); return; }
          healthy();
          if (reconstructed !== current.current) apply(reconstructed);
        }
      } catch {
        void refreshGame();
      }
    };
    health = setTimeout(retry, 12000);
    source.addEventListener("ready", snapshot);
    source.addEventListener("update", snapshot);
    source.addEventListener("ping", healthy);
    source.addEventListener("sync-error", (event: MessageEvent<string>) => {
      if (disposed) return;
      try {
        const payload = JSON.parse(event.data) as {
          code?: string;
          error?: string;
        };
        if (["GAME_NOT_FOUND", "GAME_EXPIRED", "PLAYER_NOT_IN_GAME", "GAME_SESSION_REQUIRED"].includes(payload.code ?? "")) {
          source.close();
          clearTimeout(health);
          clearTimeout(reconnect);
          live.current = false;
          fail(
            new ApiRequestError(
              payload.error ?? "La mesa ya no está disponible.",
              { code: payload.code, status: payload.code === "GAME_EXPIRED" ? 410 : 404 },
            ),
          );
        }
      } catch {
        /* The polling transport can recover malformed events. */
      }
    });
    source.onerror = retry;
    return () => {
      disposed = true;
      clearTimeout(health);
      clearTimeout(reconnect);
      source.close();
      live.current = false;
    };
  }, [gameId, playerId, status, streamEpoch, apply, fail, refreshGame, unavailable]);

  const run = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      if (mutation.current)
        throw new ApiRequestError("Ya estamos enviando tu jugada.", {
          code: "ACTION_PENDING",
          status: 409,
        });
      mutation.current = true;
      setIsBusy(true);
      clearError();
      try {
        return await operation();
      } catch (problem) {
        fail(problem);
        throw problem;
      } finally {
        mutation.current = false;
        setIsBusy(false);
      }
    },
    [clearError, fail],
  );

  const createNewGame = useCallback(
    (input: { playerName: string; numRows: number; privateInvitation?: boolean }) =>
      run(async () => {
        const epoch=generation.current;
        const snapshot = await createGame({ ...input, playerId });
        if(epoch!==generation.current)return;
        generation.current++;
        current.current = null;
        refresh.current = null;
        apply(snapshot);
      }),
    [playerId, run, apply],
  );

  const joinExistingGame = useCallback(
    (input: { playerName: string; gameCode?: string; inviteToken?: string }) =>
      run(async () => {
        const epoch = generation.current;
        const snapshot = await joinGame({ ...input, playerId });
        if(epoch!==generation.current)return;
        generation.current++;
        current.current = null;
        refresh.current = null;
        apply(snapshot);
      }),
    [playerId, run, apply],
  );

  const openGame = useCallback((id:string)=>run(async()=>{
    const epoch=++generation.current;
    const snapshot=await getGame(id,playerId);
    if(epoch!==generation.current)return;
    current.current=null;refresh.current=null;live.current=false;
    apply(snapshot);
  }),[playerId,run,apply]);
  useEffect(()=>{void refreshOpenGames();},[refreshOpenGames,gameId,status]);
  useEffect(()=>{
    if(gameId||!playerId)return;
    const refresh=()=>void refreshOpenGames();
    const timer=setInterval(refresh,15000);
    window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[gameId,playerId,refreshOpenGames]);

  const sendMove = useCallback(
    (rowIndex: number, startIndex: number, removeCount: number) =>
      run(async () => {
        const before = current.current;
        if (!before) throw new Error("No hay partida activa.");
        try {
          const snapshot = await makeMove({
            gameId: before.gameId,
            playerId,
            rowIndex,
            startIndex,
            removeCount,
            expectedRevision: before.revision,
          });
          if (current.current?.gameId === before.gameId) apply(snapshot);
        } catch (problem) {
          const confirmed =
            current.current?.gameId === before.gameId
              ? current.current.moveHistory[before.moveHistory.length]
              : null;
          if (
            confirmed &&
            !confirmed.fromDice &&
            confirmed.player === before.yourPlayerNumber &&
            confirmed.rowIndex === rowIndex &&
            confirmed.startIndex === startIndex &&
            confirmed.count === removeCount
          )
            return;
          // POST is never retried blindly. A lost response may conceal an accepted move.
          try {
            const latest = await getGame(before.gameId, playerId);
            if (current.current?.gameId !== before.gameId) return;
            apply(latest);
            const accepted = latest.moveHistory[before.moveHistory.length];
            if (
              accepted &&
              !accepted.fromDice &&
              accepted.player === before.yourPlayerNumber &&
              accepted.rowIndex === rowIndex &&
              accepted.startIndex === startIndex &&
              accepted.count === removeCount
            )
              return;
          } catch {
            live.current = false;
            setConnection(navigator.onLine ? "reconnecting" : "offline");
          }
          throw problem;
        }
      }),
    [playerId, run, apply],
  );

  const sendDice = useCallback(
    (shot?: AncientShot,target?: import("../types").DiceTarget) =>
      run(async (): Promise<DiceResult | null> => {
        const before = current.current;
        if (!before) throw new Error("No hay partida activa.");
        try {
          const result = await rollDice({
            gameId: before.gameId,
            playerId,
            expectedRevision: before.revision,
            shot,
            target,
          });
          if (current.current?.gameId === before.gameId) apply(result.game);
          return result.dice;
        } catch (problem) {
          const confirmed =
            current.current?.gameId === before.gameId
              ? current.current.moveHistory[before.moveHistory.length]
              : null;
          if (
            confirmed?.fromDice &&
            confirmed.player === before.yourPlayerNumber
          )
            return confirmed.dice ?? null;
          try {
            const latest = await getGame(before.gameId, playerId);
            if (current.current?.gameId !== before.gameId) return null;
            apply(latest);
            if (!shot && !target && latest.pendingAncientShot && latest.currentTurn === before.yourPlayerNumber)
              return {power:'antigua',affected:[],pending:true};
            if(!shot&&!target&&latest.pendingTargetPower&&latest.currentTurn===before.yourPlayerNumber)
              return {power:latest.pendingTargetPower,affected:[],pending:true};
            const accepted = latest.moveHistory[before.moveHistory.length];
            if (
              accepted?.fromDice &&
              accepted.player === before.yourPlayerNumber
            )
              return accepted.dice ?? null;
          } catch {
            live.current = false;
            setConnection(navigator.onLine ? "reconnecting" : "offline");
          }
          throw problem;
        }
      }),
    [playerId, run, apply],
  );

  const leaveCurrentGame = useCallback(
    () =>
      run(async () => {
        const before = current.current;
        if (!before) return;
        apply(await leaveGame({ gameId: before.gameId, playerId }));
      }),
    [playerId, run, apply],
  );

  return {
    openGames,openGame,refreshOpenGames,
    game,
    isBusy,
    isSyncing,
    connection,
    hasLiveChannel: connection === "live",
    lastSyncedAt,
    lastSuccess,
    error,
    errorCode,
    clearError,
    clearGame,
    createNewGame,
    joinExistingGame,
    leaveCurrentGame,
    refreshGame,
    sendMove,
    sendDice,
  };
}
