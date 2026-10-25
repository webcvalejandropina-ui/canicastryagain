import { readSmallJson } from '@/backend/shared/infrastructure/requestSecurity';
import { requirePrivateGameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const diceSchema = z.object({
  expectedRevision: z.number().int().min(0).optional(),
  shot: z.object({row:z.number().int().min(0).max(49),col:z.number().int().min(0).max(49),dx:z.number().finite().min(-100).max(100),dy:z.number().finite().min(-100).max(100),power:z.number().finite().min(.05).max(1).optional()}).strict().optional(),
  target:z.object({row:z.number().int().min(0).max(49),col:z.number().int().min(0).max(49)}).strict().optional(),
  playerId: z.string().min(1)
}).refine(value=>!(value.shot&&value.target),'Solo puedes enviar un lanzamiento o un objetivo.');

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await context.params;
    const payload = diceSchema.parse(await readSmallJson(request));

    requirePrivateGameActor(request,gameId,payload.playerId);
    const result = await container.useDiceUseCase.execute({
      gameId,
      expectedRevision: payload.expectedRevision,
      shot: payload.shot,
      target:payload.target,
      playerId: payload.playerId
    });

    return NextResponse.json({ game: result.game, dice: result.dice });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
