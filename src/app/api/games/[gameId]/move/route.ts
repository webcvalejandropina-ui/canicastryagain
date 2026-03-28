import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const moveSchema = z.object({
  playerId: z.string().min(1),
  rowIndex: z.coerce.number().int().min(0),
  startIndex: z.coerce.number().int().min(0),
  removeCount: z.coerce.number().int().min(1)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const payload = moveSchema.parse(await request.json());

    const game = await container.makeMoveUseCase.execute({
      gameId,
      playerId: payload.playerId,
      rowIndex: payload.rowIndex,
      startIndex: payload.startIndex,
      removeCount: payload.removeCount
    });
    return NextResponse.json({ game });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
