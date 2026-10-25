import { requirePrivateGameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { readGameRevision } from "@/backend/game/infrastructure/GameRevision";
import { NextResponse } from 'next/server';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const { searchParams } = new URL(request.url);
    const requesterPlayerId = searchParams.get('playerId') ?? '';

    requirePrivateGameActor(request,gameId,requesterPlayerId);
    const knownRevision = searchParams.get('revision');
    if (knownRevision !== null && requesterPlayerId && /^\d+$/.test(knownRevision) &&
        readGameRevision(gameId, requesterPlayerId) === Number(knownRevision)) {
      return NextResponse.json({ unchanged: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const game = await container.getGameUseCase.execute({
      gameId,
      requesterPlayerId
    });

    return NextResponse.json({ game }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
