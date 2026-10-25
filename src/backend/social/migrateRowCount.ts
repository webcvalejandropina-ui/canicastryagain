import type { Database } from 'better-sqlite3';

/** Called inside the store's IMMEDIATE startup transaction. No foreign keys are disabled. */
export function migrateRivalRowCount(db: Database): void {
  const schema=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='rival_invitations'").get() as {sql:string};
  if (/BETWEEN\s+3\s+AND\s+50/i.test(schema.sql)) {
    const objects=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='rival_invitations' AND type IN ('index','trigger') AND sql IS NOT NULL").all() as Array<{sql:string}>;
    db.exec(`CREATE TABLE rival_invitations_row100 (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      recipient TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      num_rows INTEGER NOT NULL CHECK(typeof(num_rows)='integer' AND num_rows BETWEEN 1 AND 100),
      status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled')),
      created INTEGER NOT NULL, expires INTEGER NOT NULL,
      game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
      CHECK(sender<>recipient)
    );
    INSERT INTO rival_invitations_row100(id,sender,recipient,num_rows,status,created,expires,game_id)
      SELECT id,sender,recipient,num_rows,status,created,expires,game_id FROM rival_invitations;
    DROP TABLE rival_invitations;
    ALTER TABLE rival_invitations_row100 RENAME TO rival_invitations;`);
    for(const object of objects)db.exec(object.sql);
    const violations=db.pragma('foreign_key_check(rival_invitations)');
    if(!Array.isArray(violations) || violations.length)throw new Error('Rival migration failed its integrity check');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS rival_schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT OR IGNORE INTO rival_schema_migrations(version) VALUES(1);`);
}
