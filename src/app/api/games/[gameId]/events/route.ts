import type { Game } from '@/backend/game/domain/Game';
import { toGameView } from '@/backend/game/application/GameView';
import { AppError } from '@/backend/shared/domain/AppError';
import { readGameRevision } from '@/backend/game/infrastructure/GameRevision';
import { makeGameDelta, gameDeltaBase } from '@/features/game/lib/gameDelta';
import { requirePrivateGameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { gameStreams } from "@/backend/game/infrastructure/GameStreamRegistry";
import { subscribeToGameEvents } from "@/backend/game/infrastructure/GameEvents";
import { container } from "@/backend/shared/infrastructure/container";
import { toHttpError } from "@/backend/shared/infrastructure/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  const { gameId } = await context.params;
  const normalizedGameId = gameId.trim();
  const requesterPlayerId =
    new URL(request.url).searchParams.get("playerId")?.trim() ?? "";

  if (!requesterPlayerId) {
    return Response.json(
      {
        error: "playerId es obligatorio para suscribirse a eventos",
        code: "INVALID_REQUEST",
      },
      { status: 400 },
    );
  }

  // Validate before allocating a long-lived stream, with an actual HTTP error.
  let initial;
  try {
    requirePrivateGameActor(request,normalizedGameId,requesterPlayerId);
    initial = await container.getGameUseCase.execute({ gameId: normalizedGameId, requesterPlayerId });
  } catch (error) {
    const httpError = toHttpError(error);
    return Response.json(httpError.body, { status: httpError.status });
  }
  const deltaUpdates = new URL(request.url).searchParams.get("updates") === "delta";
  let capacityRejected = false;
  const encoder = new TextEncoder();
  let disposed = false;
  const cleanupTasks: Array<() => void> = [];

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    cleanupTasks.forEach((task) => task());
    cleanupTasks.length = 0;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let syncInFlight = false;
      let syncQueued = false;
      let sentRevision = initial.revision;
      let sentGame = deltaUpdates ? gameDeltaBase(initial) : null;
      const subscriber = { revision: initial.revision, changed: () => syncAndSend("update", "revision-check"), ping: () => {try{requirePrivateGameActor(request,normalizedGameId,requesterPlayerId);enqueue("ping", { at: Date.now() });}catch{enqueue("sync-error",{code:"GAME_SESSION_REQUIRED",error:"Vuelve a iniciar sesión."});closeStream();}} };

      // Sugerir al navegador reconexión rápida para redes móviles inestables.
      controller.enqueue(encoder.encode("retry: 2000\n\n"));

      const enqueue = (
        eventName: string,
        payload: Record<string, unknown>,
      ): void => {
        if (disposed) return;
        const chunk = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
        try {
          // Latest snapshot is recoverable; an unbounded slow-client queue is not.
          if ((controller.desiredSize ?? 0) <= 0) { closeStream(); return; }
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const closeStream = (): void => {
        if (disposed) return;
        cleanup();
        try {
          controller.close();
        } catch {
          // El stream puede estar ya cerrado por el runtime.
        }
      };

      const syncAndSend = (
        eventName: "ready" | "update",
        source: string,
        committed?: Game,
      ): void => {
        if (disposed) return;
        if (syncInFlight) {
          syncQueued = true;
          return;
        }

        try{requirePrivateGameActor(request,normalizedGameId,requesterPlayerId);}
        catch(error){const failure=toHttpError(error);enqueue('sync-error',{...failure.body,gameId:normalizedGameId});closeStream();return;}
        // The ready snapshot already covers this revision. Duplicate events need
        // only the indexed revision lookup, not rows/history decoding.
        if (!committed && eventName !== "ready") {
          try { if (readGameRevision(normalizedGameId, requesterPlayerId) === sentRevision) return; }
          catch { /* The normal read below reports transient SQLite errors to this client. */ }
        }
        syncInFlight = true;
        const snapshot = committed
          ? Promise.resolve().then(() => {
              if (!committed.getPlayerNumber(requesterPlayerId))
                throw new AppError('Jugador no pertenece a esta partida', 403, 'PLAYER_NOT_IN_GAME');
              return toGameView(committed, requesterPlayerId);
            })
          : container.getGameUseCase.execute({gameId: normalizedGameId, requesterPlayerId});
        void snapshot
          .then((game) => {
            if (
              disposed ||
              (eventName !== "ready" && game.revision <= sentRevision)
            )
              return;
            const delta = sentGame ? makeGameDelta(sentGame, game) : null;
            sentRevision = game.revision;
            subscriber.revision = game.revision;
            sentGame = deltaUpdates ? gameDeltaBase(game) : null;
            enqueue(eventName, {
              gameId: normalizedGameId,
              source,
              at: Date.now(),
              ...(delta ? {delta} : {game}),
            });
          })
          .catch((error: unknown) => {
            const httpError = toHttpError(error);
            enqueue("sync-error", {
              gameId: normalizedGameId,
              at: Date.now(),
              error: httpError.body.error,
              code: httpError.body.code,
            });

            if (
              httpError.status === 403 ||
              httpError.status === 404 ||
              httpError.status === 410 ||
              httpError.body.code === "GAME_NOT_FOUND"
            ) {
              closeStream();
            }
          })
          .finally(() => {
            syncInFlight = false;
            if (!syncQueued || disposed) return;
            syncQueued = false;
            syncAndSend("update", "queued");
          });
      };

      const unsubscribe = subscribeToGameEvents(normalizedGameId, (event) => {
        syncAndSend("update", event.source, event.game);
      });
      cleanupTasks.push(unsubscribe);

      const release = gameStreams.subscribe(normalizedGameId, subscriber);
      if (!release) {
        capacityRejected = true;
        closeStream();
        return;
      }
      cleanupTasks.push(release);

      const onAbort = (): void => {
        closeStream();
      };

      request.signal.addEventListener("abort", onAbort, { once: true });
      cleanupTasks.push(() =>
        request.signal.removeEventListener("abort", onAbort),
      );

      if (request.signal.aborted) {
        closeStream();
        return;
      }
      enqueue("ready", { gameId: normalizedGameId, source: "initial", at: Date.now(), game: initial });
      // Catch a commit between the initial read and listener registration.
      syncAndSend("update", "subscribed");
    },
    cancel() {
      cleanup();
    },
  }, { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength });

  if (capacityRejected) return Response.json({ error: "Servidor ocupado. Reintentamos en unos segundos.", code: "STREAM_CAPACITY" }, { status: 503, headers: { "Retry-After": "10" } });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
