import { NextResponse } from 'next/server';

import { container } from '@/backend/shared/infrastructure/container';
import { toHttpError } from '@/backend/shared/infrastructure/http';

export async function GET(): Promise<NextResponse> {
  try {
    const rankings = await container.getRankingsUseCase.execute();
    return NextResponse.json({ rankings });
  } catch (error) {
    const httpError = toHttpError(error);
    return NextResponse.json(httpError.body, { status: httpError.status });
  }
}
