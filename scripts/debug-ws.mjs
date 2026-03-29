import { spawn } from 'child_process';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEST_PORT = 3102;

const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  env: { ...process.env, PORT: TEST_PORT, SOCKET_VERBOSE: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', d => console.log('SVR:', d.toString().trim()));
server.stderr.on('data', d => console.error('SVR ERR:', d.toString().trim()));

// Wait for server
await new Promise(r => setTimeout(r, 2000));

console.log('--- Test: register handler BEFORE open ---');
let p1Msg = null;
const p1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
// Register handler BEFORE waiting for open
p1.on('message', d => { p1Msg = JSON.parse(d.toString()); console.log('P1 msg:', p1Msg.type); });
await new Promise((res, rej) => { p1.on('open', res); p1.on('error', rej); });
console.log('P1 connected, waiting...');
await new Promise(r => setTimeout(r, 500));
console.log('P1 got:', p1Msg?.type ?? 'NOTHING');

console.log('\n--- Test: register handler AFTER open ---');
let p2Msg = null;
const p2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
await new Promise((res, rej) => { p2.on('open', res); p2.on('error', rej); });
console.log('P2 connected');
p2.on('message', d => { p2Msg = JSON.parse(d.toString()); console.log('P2 msg:', p2Msg.type); });
await new Promise(r => setTimeout(r, 500));
console.log('P2 got:', p2Msg?.type ?? 'NOTHING');

p1.close();
p2.close();
await new Promise(r => setTimeout(r, 500));
server.kill();
process.exit(0);