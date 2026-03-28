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
    const payload = deleteSchema.parse(await request.json());

    await container.deleteAccountUseCase.execute({
      playerId: payload.playerId,
      password: payload.password
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
