import type { Game } from '@/backend/game/domain/Game';

type GameEventSource = 'create' | 'join' | 'move' | 'leave' | 'manual';

export type GameEvent = {
  type: 'updated';
  gameId: string;
  source: GameEventSource;
  at: number;
  /** Committed in-process state; consumed locally, never exposed to the browser. */
  game?: Game;
};

type GameEventListener = (event: GameEvent) => void;

const globalForEvents = globalThis as unknown as {
  __gameEventListeners?: Map<string, Set<GameEventListener>>;
};

const listenersByGameId = (globalForEvents.__gameEventListeners ??= new Map<string, Set<GameEventListener>>());

export function subscribeToGameEvents(gameId: string, listener: GameEventListener): () => void {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) {
    return () => undefined;
  }

  let listeners = listenersByGameId.get(normalizedGameId);
  if (!listeners) {
    listeners = new Set<GameEventListener>();
    listenersByGameId.set(normalizedGameId, listeners);
  }

  listeners.add(listener);

  return () => {
    const current = listenersByGameId.get(normalizedGameId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByGameId.delete(normalizedGameId);
    }
  };
}

export function publishGameUpdated(gameId: string, source: GameEventSource = 'manual', game?: Game): void {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) return;

  const listeners = listenersByGameId.get(normalizedGameId);
  if (!listeners || listeners.size === 0) return;

  const event: GameEvent = {
    type: 'updated',
    gameId: normalizedGameId,
    source,
    at: Date.now(),
    game
  };

  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // Evitar que un listener roto afecte a los demás.
    }
  }
}
