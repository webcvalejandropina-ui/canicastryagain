import { randomBytes } from 'node:crypto';
import { sqlite } from './db/sqlite';

let storedSecret: string | undefined;

/** Share an installation-specific key across restarts and workers, never a public default. */
export function invitationSecret(): string {
  const configured = process.env.INVITE_TOKEN_SECRET?.trim();
  if (configured) {
    if (Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('INVITE_TOKEN_SECRET must contain at least 32 bytes');
    }
    return configured;
  }
  if (!storedSecret) {
    sqlite.exec('CREATE TABLE IF NOT EXISTS runtime_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    sqlite.prepare('INSERT INTO runtime_secrets(name,value) VALUES(?,?) ON CONFLICT(name) DO NOTHING')
      .run('invitation-signing', randomBytes(32).toString('hex'));
    storedSecret = (sqlite.prepare('SELECT value FROM runtime_secrets WHERE name=?')
      .get('invitation-signing') as { value: string }).value;
  }
  return storedSecret;
}
