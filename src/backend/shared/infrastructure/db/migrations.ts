import type { Database } from 'better-sqlite3';

const globalForMigrations = globalThis as unknown as { __migrationsRun?: boolean };

function safeAddColumn(db: Database, table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('duplicate column name')) throw err;
  }
}

export function runMigrations(db: Database): void {
  if (globalForMigrations.__migrationsRun) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      invite_version INTEGER NOT NULL DEFAULT 1,
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

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      alias TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_players_alias ON players(alias COLLATE NOCASE);
  `);

  safeAddColumn(db, 'games', 'forced_row_index', 'INTEGER');
  safeAddColumn(db, 'games', 'turn_die_value', 'INTEGER');
  safeAddColumn(db, 'games', 'invite_version', 'INTEGER NOT NULL DEFAULT 1');
  safeAddColumn(db, 'games', 'player1_dice_used', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'games', 'player2_dice_used', 'INTEGER NOT NULL DEFAULT 0');

  db.exec('UPDATE games SET invite_version = 1 WHERE invite_version IS NULL OR invite_version < 1');

  safeAddColumn(db, 'ranking_stats', 'score', 'INTEGER NOT NULL DEFAULT 0');

  safeAddColumn(db, 'players', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'players', 'password_reset', 'INTEGER NOT NULL DEFAULT 0');

  globalForMigrations.__migrationsRun = true;
}
