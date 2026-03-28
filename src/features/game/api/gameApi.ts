import { DiceResult, GameState, RankingEntry } from '@/features/game/types';

type ApiError = {
  error?: string;
  code?: string;
};

export class ApiRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = options.code;
    this.status = options.status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiError;

  if (!response.ok) {
    throw new ApiRequestError(data.error ?? 'Error en la solicitud', {
      code: data.code,
      status: response.status
    });
  }

  return data;
}

export async function createGame(input: {
  playerId: string;
  playerName: string;
  numRows: number;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>('/api/games', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  return data.game;
}

export async function joinGame(input: {
  playerId: string;
  playerName: string;
  gameCode?: string;
  inviteToken?: string;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>('/api/games/join', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  return data.game;
}

export async function getGame(gameId: string, playerId: string): Promise<GameState> {
  const data = await request<{ game: GameState }>(
    `/api/games/${encodeURIComponent(gameId)}?playerId=${encodeURIComponent(playerId)}`,
    {
      method: 'GET',
      cache: 'no-store'
    }
  );

  return data.game;
}

export async function makeMove(input: {
  gameId: string;
  playerId: string;
  rowIndex: number;
  startIndex: number;
  removeCount: number;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>(
    `/api/games/${encodeURIComponent(input.gameId)}/move`,
    {
      method: 'POST',
      body: JSON.stringify({
        playerId: input.playerId,
        rowIndex: input.rowIndex,
        startIndex: input.startIndex,
        removeCount: input.removeCount
      })
    }
  );

  return data.game;
}

export async function leaveGame(input: { gameId: string; playerId: string }): Promise<GameState> {
  const data = await request<{ game: GameState }>(`/api/games/${encodeURIComponent(input.gameId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: input.playerId
    })
  });

  return data.game;
}

export async function rollDice(input: {
  gameId: string;
  playerId: string;
}): Promise<{ game: GameState; dice: DiceResult }> {
  const data = await request<{ game: GameState; dice: DiceResult }>(
    `/api/games/${encodeURIComponent(input.gameId)}/dice`,
    {
      method: 'POST',
      body: JSON.stringify({ playerId: input.playerId })
    }
  );

  return data;
}

export async function getRankings(): Promise<RankingEntry[]> {
  const data = await request<{ rankings: RankingEntry[] }>('/api/rankings', {
    method: 'GET',
    cache: 'no-store'
  });

  return data.rankings;
}
