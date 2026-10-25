import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.SQLITE_PATH = ':memory:';
delete process.env.INVITE_TOKEN_SECRET;

async function run(): Promise<void> {
  const { invitationSecret } = await import('../src/backend/shared/infrastructure/invitationSecret');
  const { sqlite } = await import('../src/backend/shared/infrastructure/db/sqlite');
  const { encodeInviteToken, decodeInviteToken } = await import('../src/backend/game/application/InviteToken');
  const key = invitationSecret();
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(invitationSecret(), key);
  assert.equal((sqlite.prepare('SELECT value FROM runtime_secrets WHERE name=?').get('invitation-signing') as {value:string}).value, key);
  const token = encodeInviteToken('ABC123', 1);
  assert.deepEqual(decodeInviteToken(token), {code:'ABC123',version:1});
  const payload = token.split('.')[1];
  const oldSignature = createHmac('sha256', 'canicas-try-again-dev-secret-change-me').update(payload).digest('base64url');
  assert.throws(() => decodeInviteToken(`cta1.${payload}.${oldSignature}`), {code:'INVALID_INVITE_TOKEN'});
  process.env.INVITE_TOKEN_SECRET = 'too-short';
  assert.throws(() => encodeInviteToken('ABC123', 1), /at least 32 bytes/);
  process.env.INVITE_TOKEN_SECRET = 'a'.repeat(64);
  const configuredToken = encodeInviteToken('ABC123', 1);
  assert.deepEqual(decodeInviteToken(configuredToken), {code:'ABC123',version:1});
  assert.throws(() => decodeInviteToken(token), {code:'INVALID_INVITE_TOKEN'});
  delete process.env.INVITE_TOKEN_SECRET;
  assert.deepEqual(decodeInviteToken(token), {code:'ABC123',version:1});
  console.log('OK: persistent random installation key, explicit key validation, roundtrip and rejection of public-default signatures');
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
