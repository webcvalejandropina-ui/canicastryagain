import { requireAdmin,sameOrigin } from '@/backend/appearance/runtime';
import { readSmallJson,limitAction } from '@/backend/shared/infrastructure/requestSecurity';
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
    sameOrigin(request);const adminId=requireAdmin(request);limitAction(adminId,"reset-password",10);
    const payload = resetSchema.parse(await readSmallJson(request));
    const temporaryPassword=await container.adminUseCase.resetPassword(adminId, payload.targetId);
    return NextResponse.json({ success: true,temporaryPassword },{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
