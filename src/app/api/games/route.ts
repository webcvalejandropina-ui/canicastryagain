import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const createGameSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  numRows: z.coerce.number().int().min(3).max(50).optional().default(7)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = createGameSchema.parse(await request.json());
    const game = await container.createGameUseCase.execute(payload);
    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
