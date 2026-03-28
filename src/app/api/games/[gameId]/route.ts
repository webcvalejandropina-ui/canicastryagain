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

    const game = await container.getGameUseCase.execute({
      gameId,
      requesterPlayerId
    });

    return NextResponse.json({ game });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
