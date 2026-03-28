import { subscribeToGameEvents } from '@/backend/game/infrastructure/GameEvents';
import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
): Promise<Response> {
  const { gameId } = await context.params;
  const normalizedGameId = gameId.trim();
  const requesterPlayerId = new URL(request.url).searchParams.get('playerId')?.trim() ?? '';

  if (!requesterPlayerId) {
    return Response.json(
      {
        error: 'playerId es obligatorio para suscribirse a eventos',
        code: 'INVALID_REQUEST'
      },
      { status: 400 }
    );
  }

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

      // Sugerir al navegador reconexión rápida para redes móviles inestables.
      controller.enqueue(encoder.encode('retry: 2000\n\n'));

      const enqueue = (eventName: string, payload: Record<string, unknown>): void => {
        if (disposed) return;
        const chunk = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
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

      const syncAndSend = (eventName: 'ready' | 'update', source: string): void => {
        if (disposed) return;
        if (syncInFlight) {
          syncQueued = true;
          return;
        }

        syncInFlight = true;
        void container.getGameUseCase
          .execute({
            gameId: normalizedGameId,
            requesterPlayerId
          })
          .then((game) => {
            enqueue(eventName, {
              gameId: normalizedGameId,
              source,
              at: Date.now(),
              game
            });
          })
          .catch((error: unknown) => {
            const httpError = toHttpError(error);
            enqueue('sync-error', {
              gameId: normalizedGameId,
              at: Date.now(),
              error: httpError.body.error,
              code: httpError.body.code
            });

            if (httpError.status === 404 || httpError.body.code === 'GAME_NOT_FOUND') {
              closeStream();
            }
          })
          .finally(() => {
            syncInFlight = false;
            if (!syncQueued || disposed) return;
            syncQueued = false;
            syncAndSend('update', 'queued');
          });
      };

      const unsubscribe = subscribeToGameEvents(normalizedGameId, (event) => {
        syncAndSend('update', event.source);
      });
      cleanupTasks.push(unsubscribe);

      const heartbeat = setInterval(() => {
        enqueue('ping', { gameId: normalizedGameId, at: Date.now() });
      }, 8000);
      cleanupTasks.push(() => clearInterval(heartbeat));

      const onAbort = (): void => {
        closeStream();
      };

      request.signal.addEventListener('abort', onAbort, { once: true });
      cleanupTasks.push(() => request.signal.removeEventListener('abort', onAbort));

      syncAndSend('ready', 'initial');
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
