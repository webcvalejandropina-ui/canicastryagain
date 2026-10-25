#!/usr/bin/env node
// Only target an explicitly supplied local test server; creates synthetic matches.
import {createQaActors} from './qa-game-actors.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const base = process.env.LOAD_URL;
if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('LOAD_URL must be an isolated http://127.0.0.1:PORT test server');
const deltaMode = process.env.LOAD_DELTAS === '1';
const applyDelta = deltaMode ? (await import('../src/features/game/lib/gameDelta.ts')).applyGameDelta : null;
let streamBytes = 0, patchFrames = 0, fullFrames = 0;
const gamesCount = Number(process.env.LOAD_GAMES ?? 100);
const numRows = Number(process.env.LOAD_ROWS ?? 3);
const turns = numRows * (numRows + 1) / 2;
const clientConcurrency = Number(process.env.LOAD_CONCURRENCY ?? 24);
if (!Number.isInteger(gamesCount) || gamesCount < 1 || gamesCount > 2000 || !Number.isInteger(numRows) || numRows < 1 || numRows > 100 || !Number.isInteger(clientConcurrency) || clientConcurrency < 1 || clientConcurrency > 500) throw Error("Invalid load size");
const fixture=createQaActors(gamesCount*2);
const cookies=new Map(fixture.actors.map(a=>[a.playerId,a.cookie]));
const pid = process.env.LOAD_PID;
const errors = [], httpTimes = [], deliveryTimes = [], readyTimes = [];
let bytes = 0, maxRSSKiB = 0, requests = 0;
const runId = `load-${Date.now()}`;
const started = performance.now();
function resources() {
  if (!pid) return null;
  const raw = execFileSync('ps', ['-p', pid, '-o', 'rss=,time='], { encoding: 'utf8' }).trim();
  const [rss, time] = raw.split(/\s+/);
  maxRSSKiB = Math.max(maxRSSKiB, Number(rss));
  const parts = time.split(':').map(Number);
  return { rssMiB: Number(rss) / 1024, cpuSeconds: parts.reduce((sum, n) => sum * 60 + n, 0) };
}
const before = resources();
const sample = setInterval(resources, 1000);
async function pool(items, task, concurrency = clientConcurrency) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) await task(items[i++]);
  }));
}
async function api(path, body) {
  const start = performance.now(); requests++;
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {'content-type':'application/json',Origin:base,Cookie:cookies.get(body?.playerId??new URL(base+path).searchParams.get('playerId'))??''}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const text = await response.text(); bytes += Buffer.byteLength(text); httpTimes.push(performance.now() - start);
  const data = JSON.parse(text);
  if (!response.ok) throw Error(`${response.status}: ${JSON.stringify(data)}`);
  return data;
}
function stream(game, playerId) {
  const abort = new AbortController();
  const received = new Map(); let failure;
  let buffer = ''; let currentGame = null;
  const opened = performance.now();
  const task = (async () => {
    const response = await fetch(`${base}/api/games/${game.gameId}/events?playerId=${playerId}${deltaMode ? "&updates=delta" : ""}`, { signal: abort.signal,headers:{Cookie:cookies.get(playerId)} });
    if (!response.ok) throw Error(`SSE ${response.status}`);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength; streamBytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const line = frame.split('\n').find(line => line.startsWith('data: '));
        if (!line) continue;
        const data = JSON.parse(line.slice(6));
        if (data.delta) {
          patchFrames++;
          currentGame = applyDelta(currentGame, data.delta);
          assert.ok(currentGame, 'A live delta must reconstruct exactly');
        } else if (data.game) { fullFrames++; currentGame = data.game; }
        if (data.game || data.delta) {
          received.set(currentGame.revision, { at: performance.now(), game: currentGame });
          if (frame.includes('event: ready')) readyTimes.push(performance.now() - opened);
        }
        if (frame.includes('sync-error')) throw Error(JSON.stringify(data));
      }
    }
  })().catch(error => { if (!abort.signal.aborted) { failure = error; errors.push(String(error)); } });
  return { received, async revision(revision) {
    const deadline = performance.now() + 10000;
    while (!received.has(revision)) {
      if (failure) throw failure;
      if (performance.now() > deadline) throw Error(`Missing SSE revision ${revision} for ${game.gameId}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return received.get(revision);
  }, async close() { abort.abort(); await task; } };
}
const games = [], channels = [];
try {
  await pool(Array.from({ length: gamesCount }, (_, i) => i), async i => {
    const players = [fixture.actors[i*2].playerId,fixture.actors[i*2+1].playerId];
    let { game } = await api('/api/games', { playerId: players[0], playerName: 'Carga A', numRows });
    ({ game } = await api('/api/games/join', { playerId: players[1], playerName: 'Carga B', gameCode: game.gameCode }));
    const streams = players.map(player => stream(game, player));
    channels.push(...streams);
    await Promise.all(streams.map(s => s.revision(game.revision)));
    games.push({ game, players, streams });
  });
  const connected = performance.now();
  const idleStart = resources();
  await new Promise(resolve => setTimeout(resolve, 10000));
  const idleEnd = resources();
  // Real sockets disconnected and re-established before continuing the same authoritative game.
  await pool(games.filter((_, i) => i % 5 === 0), async entry => {
    await entry.streams[0].close();
    entry.streams[0] = stream(entry.game, entry.players[0]); channels.push(entry.streams[0]);
    await entry.streams[0].revision(entry.game.revision);
    const unchanged = await api(`/api/games/${entry.game.gameId}?playerId=${entry.players[0]}&revision=${entry.game.revision}`);
    if (process.env.LOAD_BASELINE === "1") assert.deepEqual(unchanged.game.rows, entry.game.rows);
    else assert.equal(unchanged.unchanged, true);
  });
  await pool(games, async entry => {
    for (let turn = 0; turn < turns; turn++) {
      const game = entry.game;
      const rowIndex = game.rows.findIndex(row => row.includes(1));
      const startIndex = game.rows[rowIndex].indexOf(1);
      const sendAt = performance.now();
      const result = await api(`/api/games/${game.gameId}/move`, { playerId: entry.players[game.currentTurn - 1], rowIndex, startIndex, removeCount: 1, expectedRevision: game.revision });
      entry.game = result.game;
      const snapshots = await Promise.all(entry.streams.map(s => s.revision(result.game.revision)));
      for (const snapshot of snapshots) {
        deliveryTimes.push(snapshot.at - sendAt);
        assert.deepEqual(snapshot.game.rows, result.game.rows);
        assert.equal(snapshot.game.moveHistory.length, turn + 1);
      }
    }
    assert.equal(entry.game.status, 'finished');
    assert.equal(entry.game.moveHistory.length, turns);
  });
  const after = resources();
  function stats(values) { const sorted = [...values].sort((a,b)=>a-b); return { count: sorted.length, p50ms: +sorted[Math.floor(sorted.length * .5)].toFixed(2), p95ms: +sorted[Math.floor(sorted.length * .95)].toFixed(2), maxMs: +sorted.at(-1).toFixed(2) }; }
  const report = { runId, base, deltaMode, patchFrames, fullFrames, sseMiB: +(streamBytes/1024/1024).toFixed(3), games: gamesCount, clientConcurrency, numRows, movesPerGame: turns, simultaneousPlayers: gamesCount * 2, completedGames: games.length, reconnects: Math.ceil(gamesCount / 5), requests, errors, elapsedSeconds: +( (performance.now()-started)/1000).toFixed(2), connectPhaseSeconds: +((connected-started)/1000).toFixed(2), http: stats(httpTimes), sseDelivery: stats(deliveryTimes), streamReady: stats(readyTimes), receivedMiB: +(bytes/1024/1024).toFixed(3), resources: { before, after, maxRSSMiB: maxRSSKiB/1024, idleCPUSeconds: idleEnd && idleStart ? idleEnd.cpuSeconds-idleStart.cpuSeconds : null }, environment: { node: process.version, platform: process.platform, heapLimitMiB: 320, note: 'Loopback synthetic load on host; not a certified 1-vCPU VPS or physical mobile network.' } };
  mkdirSync('entregables/conectividad', { recursive: true });
  const output = `entregables/conectividad/${process.env.LOAD_LABEL ?? runId}.json`;
  writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0);
} finally {
  clearInterval(sample);
  await Promise.all(channels.map(s => s.close()));
  fixture.cleanup();
}
