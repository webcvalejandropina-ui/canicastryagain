import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function GET(): Response {
  try {
    sqlite.prepare('SELECT 1').get();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
