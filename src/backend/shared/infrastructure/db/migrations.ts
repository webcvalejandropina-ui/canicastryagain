import type { Database } from 'better-sqlite3';

const globalForMigrations = globalThis as unknown as { __migratedDatabases?: WeakSet<Database> };
const migratedDatabases = (globalForMigrations.__migratedDatabases ??= new WeakSet<Database>());

function safeAddColumn(db: Database, table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('duplicate column name')) throw err;
  }
}

export function runMigrations(db: Database): void {
  if (migratedDatabases.has(db)) return;

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

    CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id,status,updated_at);
    CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id,status,updated_at);
    CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    CREATE INDEX IF NOT EXISTS idx_games_waiting_expiry ON games(status, created_at);

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

  safeAddColumn(db, 'games', 'private_invite_token', 'TEXT');
  safeAddColumn(db, 'games', 'private_invite_expires_at', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_games_private_invite ON games(private_invite_token) WHERE private_invite_token IS NOT NULL');
  db.exec(`CREATE TABLE IF NOT EXISTS game_guest_sessions (token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, player_name TEXT NOT NULL, expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_game_guest_expiry ON game_guest_sessions(expires);`);
  safeAddColumn(db, 'games', 'revision', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE games SET revision = 1 WHERE revision = 0');
  safeAddColumn(db, 'games', 'pending_ancient_shot', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'games', 'pending_target_power', 'TEXT');
  safeAddColumn(db, 'games', 'forced_row_index', 'INTEGER');
  safeAddColumn(db, 'games', 'turn_die_value', 'INTEGER');
  safeAddColumn(db, 'games', 'invite_version', 'INTEGER NOT NULL DEFAULT 1');
  safeAddColumn(db, 'games', 'player1_dice_used', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'games', 'player2_dice_used', 'INTEGER NOT NULL DEFAULT 0');

  db.exec('UPDATE games SET invite_version = 1 WHERE invite_version IS NULL OR invite_version < 1');

  safeAddColumn(db, 'ranking_stats', 'score', 'INTEGER NOT NULL DEFAULT 0');

  safeAddColumn(db, 'players', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
  safeAddColumn(db, 'players', 'password_reset', 'INTEGER NOT NULL DEFAULT 0');

  db.transaction(() => {
    safeAddColumn(db, 'players', 'age', "INTEGER CHECK (age IS NULL OR (typeof(age) = 'integer' AND age BETWEEN 0 AND 120))");
    safeAddColumn(db, 'players', 'locality', 'TEXT CHECK (locality IS NULL OR length(locality) <= 80)');
    safeAddColumn(db, 'players', 'birthday', `TEXT CHECK (birthday IS NULL OR (
      typeof(birthday)='text' AND birthday GLOB '[0-9][0-9]-[0-9][0-9]'
      AND CAST(substr(birthday,1,2) AS INTEGER) BETWEEN 1 AND 12
      AND CAST(substr(birthday,4,2) AS INTEGER) BETWEEN 1 AND 31
      AND strftime('%m-%d',date('2000-'||birthday,'+0 days'))=birthday))`);
  })();

  migratedDatabases.add(db);
}
