import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { StreamRegistry } from '../src/backend/game/infrastructure/StreamRegistry';
import { reconnectDelay } from '../src/features/game/lib/synchronization';
async function run() {
let reads = 0, revision: number | null = 1, changes = 0, pings = 0;
const registry = new StreamRegistry(() => { reads++; return revision; }, 1000);
const releases: (() => void)[] = [];
for (let g = 0; g < 100; g++) for (let p = 0; p < 2; p++) {
  const client = { revision: 1, changed: () => { changes++; client.revision = revision ?? -1; }, ping: () => pings++ };
  releases.push(registry.subscribe(`game-${g}`, client)!);
}
for (let i = 0; i < 3; i++) registry.tick();
assert.equal(reads, 300, 'One cheap revision read per game, independent of participants');
assert.equal(changes, 0, 'An idle phone must never reload the full game');
assert.equal(pings, 200);
revision = 2;
registry.tick();
assert.equal(changes, 200, 'External worker commits reach every participant');
registry.tick();
assert.equal(changes, 200, 'A revision is delivered only once');
revision = null;
registry.tick();
assert.equal(changes, 400, 'Deletion/expiry invalidates every subscriber');
releases.forEach(release => { release(); release(); });
assert.equal(registry.activeConnections, 0);
assert.equal(registry.activeGames, 0);
const bounded = new StreamRegistry(() => 1, 1);
const release = bounded.subscribe('g', { revision: 1, changed() {}, ping() {} })!;
assert.equal(bounded.subscribe('other', { revision: 1, changed() {}, ping() {} }), null);
release();
const perGame = new StreamRegistry(() => 1, 100);
const tabs = Array.from({ length: 8 }, () => perGame.subscribe('same-game', { revision: 1, changed() {}, ping() {} })!);
assert.equal(perGame.subscribe('same-game', { revision: 1, changed() {}, ping() {} }), null);
tabs.forEach(close => close());
for (let n = 0; n < 50; n++) {
  assert.ok(reconnectDelay(n, 0) >= 500);
  assert.ok(reconnectDelay(n, 1) <= 30000);
  assert.ok(reconnectDelay(n, 0) < reconnectDelay(n, 1), 'Reconnects must be staggered');
}
// Fast cross-process invalidation scans only after a database change or the 6s safety tick.
let databaseVersion=1, fastReads=0, fastPings=0, fastChanges=0;
const fast = new StreamRegistry(() => {fastReads++;return 2},100,()=>databaseVersion);
const fastSubscriber={revision:1,changed(){fastChanges++;fastSubscriber.revision=2},ping(){fastPings++}};
const releaseFast=fast.subscribe('remote',fastSubscriber)!;
fast.tick();assert.equal(fastReads,1);assert.equal(fastChanges,1);
fast.tick();assert.equal(fastReads,1,'Unchanged database skips all per-game revision reads');
databaseVersion++;fast.tick();assert.equal(fastReads,2,'Remote commit is visible on the next 500ms tick');
for(let tick=3;tick<18;tick++)fast.tick();
assert.equal(fastReads,3,'Periodic safety scan still notices expirations and same-connection manual writes');
assert.equal(fastPings,1,'Keep the existing nine-second mobile heartbeat');
releaseFast();assert.equal(fast.activeConnections,0);
process.env.SQLITE_PATH = ':memory:';
const { Game } = await import('../src/backend/game/domain/Game');
const { SqliteGameRepository } = await import('../src/backend/game/infrastructure/SqliteGameRepository');
const { GET: getGame } = await import('../src/app/api/games/[gameId]/route');
const { GET: events } = await import('../src/app/api/games/[gameId]/events/route');
const repository = new SqliteGameRepository();
const {sqlite:authDb}=await import('../src/backend/shared/infrastructure/db/sqlite');
function authCookie(id:string){const token=createHash('sha256').update(id).digest('hex');authDb.prepare('INSERT INTO players(id,alias,password_hash) VALUES(?,?,?)').run(id,id,'fixture');authDb.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+60000);return `canicas_session=${token}`;}
const oneCookie=authCookie('one'),slowCookie=authCookie('slow-a');

const game = Game.create({ id: 'capacity', code: 'CAP001', numRows: 3, creator: { id: 'one', name: 'Uno' } });
await repository.save(game);
const params = { params: Promise.resolve({ gameId: 'capacity' }) };
assert.deepEqual(await (await getGame(new Request('http://localhost/api/games/capacity?playerId=one&revision=1',{headers:{cookie:oneCookie}}), params)).json(), { unchanged: true });
assert.equal((await getGame(new Request('http://localhost/api/games/capacity?playerId=stranger&revision=1'), params)).status, 403);
assert.equal((await events(new Request('http://localhost/api/games/capacity/events?playerId=stranger'), params)).status, 403);
const { gameStreams } = await import('../src/backend/game/infrastructure/GameStreamRegistry');
assert.equal(gameStreams.activeConnections, 0, 'Invalid subscriptions allocate no lasting resources');
const { toHttpError } = await import('../src/backend/shared/infrastructure/http');
assert.equal(toHttpError(Object.assign(new Error('busy'), { code: 'SQLITE_BUSY' })).status, 503);
const { sameOrigin, issueSession } = await import('../src/backend/appearance/runtime');
const { NextResponse } = await import('next/server');
const { sqlite } = await import('../src/backend/shared/infrastructure/db/sqlite');
process.env.PUBLIC_ORIGIN = 'https://canicas.example:8443';
const proxied = new Request('http://internal:3000/api/auth/login', { headers: { host: 'canicas.example:8443', origin: 'https://canicas.example:8443' } });
assert.doesNotThrow(() => sameOrigin(proxied));
const { getPublicShareOrigin } = await import('../src/backend/shared/infrastructure/publicShareOrigin');
assert.equal(getPublicShareOrigin(), 'https://canicas.example:8443');
for (const origin of ['http://canicas.example:8443', 'https://canicas.example', 'https://evil.example']) {
  assert.throws(() => sameOrigin(new Request(proxied.url, { headers: { host: 'canicas.example:8443', origin } })), { code: 'INVALID_ORIGIN' });
}
sqlite.prepare("INSERT INTO players(id,alias,password_hash,created_at) VALUES ('secure-session','Seguro','fixture',CURRENT_TIMESTAMP)").run();
const session = NextResponse.json({ ok: true });
issueSession(session, 'secure-session', proxied);
assert.match(session.headers.get('set-cookie')!, /; Secure;/i, 'HTTPS sessions remain secure behind a TLS proxy');
delete process.env.PUBLIC_ORIGIN;
assert.throws(() => sameOrigin(new Request('http://localhost:13000/', { headers: { origin:'http://localhost:13001' } })), { code:'INVALID_ORIGIN' });
// A phone that stops reading cannot retain an unbounded stream queue.
const large = Game.create({ id: 'slow', code: 'SLOW01', numRows: 100, creator: { id: 'slow-a', name: 'Slow A' } });
large.join({ id: 'slow-b', name: 'Slow B' });
await repository.save(large);
const slow = await events(new Request('http://localhost/api/games/slow/events?playerId=slow-a',{headers:{cookie:slowCookie}}), { params: Promise.resolve({ gameId: 'slow' }) });
const { publishGameUpdated } = await import('../src/backend/game/infrastructure/GameEvents');
for (let i = 0; i < 100; i++) {
  const loaded = (await repository.getById('slow'))!;
  const state = loaded.toPrimitives();
  const rowIndex = state.rows.findIndex(row => row.includes(1));
  loaded.makeMove({ playerId: state.currentTurn === 1 ? 'slow-a' : 'slow-b', rowIndex, startIndex: state.rows[rowIndex].indexOf(1), removeCount: 1 });
  await repository.save(loaded);
  publishGameUpdated('slow', 'move');
  await new Promise(resolve => setImmediate(resolve));
}
assert.equal(gameStreams.activeConnections, 0, 'The slow consumer is detached once its bounded queue fills');
await slow.body!.cancel();
console.log('OK: shared watcher, idle reads, fanout, cross-worker invalidation, cleanup, capacity, jitter and private conditional snapshots');

}
void run().catch(error => { console.error(error); process.exitCode = 1; });
