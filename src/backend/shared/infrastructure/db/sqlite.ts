import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { runMigrations } from '@/backend/shared/infrastructure/db/migrations';

export const sqlitePath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'game.db');

fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

export const sqlite = new Database(sqlitePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

runMigrations(sqlite);
