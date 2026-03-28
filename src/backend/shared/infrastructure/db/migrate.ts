import { sqlite } from '@/backend/shared/infrastructure/db/sqlite';

const row = sqlite.prepare('SELECT 1 as ok').get() as { ok: number };
if (row?.ok !== 1 && process.env.NODE_ENV === 'development') {
  console.warn('SQLite: verificación DB inesperada');
}
