import { readSmallJson, limitAction } from '@/backend/shared/infrastructure/requestSecurity';
import { NextResponse } from 'next/server';
import { issueSession, sameOrigin } from '@/backend/appearance/runtime';
import { playerProfileSchema } from '@/features/session/profile';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const loginSchema = playerProfileSchema.extend({
  alias: z.string().min(1, 'El alias es obligatorio').max(32),
  password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres').max(128)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    sameOrigin(request);
    limitAction("global","login-load",240);
    const payload = loginSchema.parse(await readSmallJson(request));

    limitAction(payload.alias.trim().toLowerCase(),"login",10);
    const result = await container.authenticateUseCase.execute({
      alias: payload.alias,
      password: payload.password,
      age: payload.age,
      locality: payload.locality,
      birthday: payload.birthday
    });

    const response = NextResponse.json(result, {headers:{'Cache-Control':'private, no-store'}});
    issueSession(response, result.playerId, request);
    return response;
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
