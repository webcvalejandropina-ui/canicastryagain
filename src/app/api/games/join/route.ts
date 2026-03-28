import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const joinGameSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  gameCode: z.string().optional(),
  inviteToken: z.string().optional()
}).refine((payload) => Boolean(payload.gameCode?.trim() || payload.inviteToken?.trim()), {
  message: 'Debes indicar un código o token de partida',
  path: ['gameCode']
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = joinGameSchema.parse(await request.json());
    const game = await container.joinGameUseCase.execute(payload);
    return NextResponse.json({ game });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
