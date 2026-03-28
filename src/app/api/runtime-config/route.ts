import { NextResponse } from 'next/server';

import { getPublicShareOrigin } from '@/backend/shared/infrastructure/publicShareOrigin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      publicShareOrigin: getPublicShareOrigin()
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    }
  );
}
