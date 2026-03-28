import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const diceSchema = z.object({
  playerId: z.string().min(1)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const payload = diceSchema.parse(await request.json());

    const result = await container.useDiceUseCase.execute({
      gameId,
      playerId: payload.playerId
    });

    return NextResponse.json({ game: result.game, dice: result.dice });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
