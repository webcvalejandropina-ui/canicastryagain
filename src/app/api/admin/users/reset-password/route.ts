import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const resetSchema = z.object({
  adminId: z.string().min(1),
  targetId: z.string().min(1)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = resetSchema.parse(await request.json());
    container.adminUseCase.resetPassword(payload.adminId, payload.targetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
