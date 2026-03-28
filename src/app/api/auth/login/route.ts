import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const loginSchema = z.object({
  alias: z.string().min(1, 'El alias es obligatorio').max(32),
  password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres')
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = loginSchema.parse(await request.json());

    const result = await container.authenticateUseCase.execute({
      alias: payload.alias,
      password: payload.password
    });

    return NextResponse.json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
