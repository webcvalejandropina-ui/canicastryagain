import { NextResponse } from 'next/server';
import { z } from 'zod';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

const deleteSchema = z.object({
  adminId: z.string().min(1),
  targetId: z.string().min(1)
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const adminId = new URL(request.url).searchParams.get('adminId') ?? '';
    if (!adminId) {
      return NextResponse.json({ error: 'adminId requerido', code: 'MISSING_ADMIN_ID' }, { status: 400 });
    }

    const users = container.adminUseCase.listUsers(adminId);
    return NextResponse.json({ users });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const payload = deleteSchema.parse(await request.json());
    container.adminUseCase.deleteUser(payload.adminId, payload.targetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
