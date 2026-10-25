import { sameOrigin,clearSession } from '@/backend/appearance/runtime';
import { requireGameActor } from '@/backend/game/infrastructure/PrivateGameSession';
import { readSmallJson,limitAction } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const deleteSchema = z.object({
  playerId: z.string().min(1, 'El playerId es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria')
});

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    sameOrigin(request);
    const payload = deleteSchema.parse(await readSmallJson(request));
    requireGameActor(request,payload.playerId);limitAction(payload.playerId,"delete-account",5);

    await container.deleteAccountUseCase.execute({
      playerId: payload.playerId,
      password: payload.password
    });

    const response=NextResponse.json({ success: true });clearSession(request,response);return response;
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
