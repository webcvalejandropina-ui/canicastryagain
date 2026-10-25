import { AncientShot, DiceResult, GameState, RankingEntry } from "@/features/game/types";

type ApiError = {
  error?: string;
  code?: string;
};

export class ApiRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = options.code;
    this.status = options.status;
  }
}

export async function request<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 7_000,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiRequestError("Sin conexión. Tu partida sigue guardada.", {
      code: "NETWORK_ERROR",
      status: 0,
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = (await response.json().catch(() => null)) as
      | (T & ApiError)
      | null;
    if (!response.ok) {
      throw new ApiRequestError(
        data?.error ?? "No se pudo completar la solicitud",
        { code: data?.code, status: response.status },
      );
    }
    if (!data)
      throw new ApiRequestError(
        "Respuesta incompleta. Volvemos a comprobar la partida.",
        { code: "INVALID_RESPONSE", status: 502 },
      );
    return data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      controller.signal.aborted
        ? "La red está tardando. Comprobamos si la jugada llegó."
        : "No se pudo conectar. Tu partida sigue guardada.",
      {
        code: controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        status: 0,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function createGame(input: {
  privateInvitation?: boolean;
  playerId: string;
  playerName: string;
  numRows: number;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>("/api/games", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.game;
}

export async function joinGame(input: {
  playerId: string;
  playerName: string;
  gameCode?: string;
  inviteToken?: string;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>("/api/games/join", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.game;
}

export async function getGame(
  gameId: string,
  playerId: string,
  known?: GameState,
): Promise<GameState> {
  const revision = known?.gameId === gameId ? `&revision=${known.revision}` : "";
  const data = await request<{ game: GameState; unchanged?: boolean }>(
    `/api/games/${encodeURIComponent(gameId)}?playerId=${encodeURIComponent(playerId)}${revision}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return data.unchanged && known ? known : data.game;
}

export async function makeMove(input: {
  gameId: string;
  playerId: string;
  rowIndex: number;
  startIndex: number;
  removeCount: number;
  expectedRevision?: number;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>(
    `/api/games/${encodeURIComponent(input.gameId)}/move`,
    {
      method: "POST",
      body: JSON.stringify({
        playerId: input.playerId,
        expectedRevision: input.expectedRevision,
        rowIndex: input.rowIndex,
        startIndex: input.startIndex,
        removeCount: input.removeCount,
      }),
    },
  );

  return data.game;
}

export async function leaveGame(input: {
  gameId: string;
  playerId: string;
}): Promise<GameState> {
  const data = await request<{ game: GameState }>(
    `/api/games/${encodeURIComponent(input.gameId)}/leave`,
    {
      method: "POST",
      body: JSON.stringify({
        playerId: input.playerId,
      }),
    },
  );

  return data.game;
}

export async function rollDice(input: {
  expectedRevision?: number;
  shot?: AncientShot;
  target?: import("../types").DiceTarget;
  gameId: string;
  playerId: string;
}): Promise<{ game: GameState; dice: DiceResult }> {
  const data = await request<{ game: GameState; dice: DiceResult }>(
    `/api/games/${encodeURIComponent(input.gameId)}/dice`,
    {
      method: "POST",
      body: JSON.stringify({
        playerId: input.playerId,
        expectedRevision: input.expectedRevision,
        shot: input.shot,
        target:input.target,
      }),
    },
  );

  return data;
}

export async function getRankings(): Promise<RankingEntry[]> {
  const data = await request<{ rankings: RankingEntry[] }>("/api/rankings", {
    method: "GET",
    cache: "no-store",
  });

  return data.rankings;
}
