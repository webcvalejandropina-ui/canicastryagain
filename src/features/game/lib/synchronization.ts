import type { GameState } from "../types";

export type ConnectionState =
  | "connecting"
  | "live"
  | "polling"
  | "offline"
  | "reconnecting";

/** All transports share one ordering rule; a delayed GET must never undo an SSE move. */
export function newerSnapshot(
  current: GameState | null,
  incoming: GameState,
): GameState {
  if (!current || current.gameId !== incoming.gameId) return incoming;
  if (current.revision !== undefined && incoming.revision !== undefined) {
    return incoming.revision > current.revision ? incoming : current;
  }
  if (incoming.moveHistory.length < current.moveHistory.length) return current;
  if (current.status === "finished" && incoming.status !== "finished")
    return current;
  return incoming;
}

/** Bounded equal jitter avoids a reconnect storm after a shared network outage. */
export function reconnectDelay(attempt: number, random = Math.random()): number {
  const ceiling = Math.min(1000 * 2 ** Math.min(Math.max(attempt, 0), 5), 30000);
  return Math.round(ceiling * (0.5 + Math.max(0, Math.min(1, random)) * 0.5));
}
