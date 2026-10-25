import {createQaActors} from './qa-game-actors.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const base = process.env.CONNECTIVITY_URL, other = process.env.CONNECTIVITY_OTHER_URL;
const deltaMode=process.env.CONNECTIVITY_DELTAS==='1';
const applyDelta=deltaMode?(await import('../src/features/game/lib/gameDelta.ts')).applyGameDelta:null;
let currentGame=null;
for (const url of [base, other]) if (!url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw Error('Use two isolated local servers sharing a disposable database');
const fixture=createQaActors(2);
const [a,b]=fixture.actors;
const cookie=id=>fixture.actors.find(a=>a.playerId===id)?.cookie;
const send = async (origin, path, payload) => {
  const response = await fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json',Origin:origin,Cookie:cookie(payload.playerId) }, body: JSON.stringify(payload) });
  const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data.game;
};
const id = `worker-${Date.now()}`;
let game = await send(base, '/api/games', { playerId: a.playerId, playerName: 'Worker A', numRows: 3 });
game = await send(base, '/api/games/join', { playerId: b.playerId, playerName: 'Worker B', gameCode: game.gameCode });
const abort = new AbortController();
const response = await fetch(`${base}/api/games/${game.gameId}/events?playerId=${b.playerId}${deltaMode?"&updates=delta":""}`, { signal: abort.signal,headers:{Cookie:b.cookie} });
const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
async function revision(rev) {
  const timeout = setTimeout(() => abort.abort(), 6500);
  try { for (;;) {
    const end = buffer.indexOf('\n\n');
    if (end >= 0) {
      const frame = buffer.slice(0, end); buffer = buffer.slice(end+2);
      const line = frame.split('\n').find(l => l.startsWith('data: '));
      if (line) { const data = JSON.parse(line.slice(6)); if(data.game)currentGame=data.game;else if(data.delta){currentGame=applyDelta(currentGame,data.delta);assert.ok(currentGame);} if(currentGame?.revision===rev)return currentGame; }
    } else { const { value, done } = await reader.read(); assert.equal(done, false); buffer += decoder.decode(value); }
  } } finally { clearTimeout(timeout); }
}
try {
  await revision(2);
  const start = performance.now();
  const next = await send(other, `/api/games/${game.gameId}/move`, { playerId: a.playerId, rowIndex: 0, startIndex: 0, removeCount: 1, expectedRevision: 2 });
  const synchronized = await revision(3);
  assert.deepEqual(synchronized.rows, next.rows);
  const delay = performance.now()-start;
  assert.ok(delay < 6500);
  const stale = await fetch(`${base}/api/games/${game.gameId}/move`, { method: 'POST', headers: { 'content-type': 'application/json',Origin:base,Cookie:a.cookie }, body: JSON.stringify({ playerId:a.playerId, rowIndex:0, startIndex:0, removeCount:1, expectedRevision:2 }) });
  assert.equal(stale.status, 409, 'A retried command must not be applied twice across workers');
  const report = { deltaMode, crossWorkerDeliveryMs: +delay.toFixed(2), revision: synchronized.revision, duplicateStatus: stale.status, identicalBoards: true };
  writeFileSync(`entregables/conectividad/${process.env.CONNECTIVITY_LABEL??'dos-procesos'}.json`, JSON.stringify(report,null,2)+'\n');
  console.log(report);
} finally { abort.abort();fixture.cleanup(); }
