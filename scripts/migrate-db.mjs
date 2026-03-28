import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const sqlitePath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'game.db');

fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

const db = new Database(sqlitePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    num_rows INTEGER NOT NULL,
    rows_json TEXT NOT NULL,
    status TEXT NOT NULL,
    current_turn INTEGER NOT NULL,
    last_touched_row_index INTEGER,
    winner INTEGER,
    player1_id TEXT,
    player1_name TEXT,
    player2_id TEXT,
    player2_name TEXT,
    move_history_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
  CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

  CREATE TABLE IF NOT EXISTS ranking_stats (
    player_id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    games INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_ranking_wins ON ranking_stats(wins DESC);
`);

console.log(`SQLite inicializada en: ${sqlitePath}`);

db.close();
