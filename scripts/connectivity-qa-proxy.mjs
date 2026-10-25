// Disposable local fault-injection proxy; never used by production.
import http from 'node:http';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const port = Number(process.env.QA_PROXY_PORT ?? 13005);
const target = Number(process.env.QA_TARGET_PORT ?? 13001);
const fixtureFile = '/private/tmp/canicas-connectivity-fixture.json';
const stateFile = '/private/tmp/canicas-connectivity-network.json';
const logFile = '/private/tmp/canicas-connectivity-network.log';
let mode = 'online'; const live = new Set();
function readMode() { try { return JSON.parse(readFileSync(stateFile)).mode; } catch { return 'online'; } }
const watch = setInterval(() => {
  const next = readMode();
  if (next === 'offline' && mode !== 'offline') for (const response of live) response.destroy();
  mode = next;
}, 100);
const server = http.createServer((req,res) => {
  if (req.url === '/__bootstrap') {
    const fixture = JSON.parse(readFileSync(fixtureFile));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': fixture.cookie });
    res.end(`<!doctype html><meta charset="utf-8"><title>Prueba aislada de conexión</title><p>Cuenta y partida sintéticas; no usa datos reales.</p><button id="enter">Entrar en prueba de conexión</button><script>document.getElementById('enter').onclick=()=>{localStorage.setItem('canicas-try-again-player-session-v1',${JSON.stringify(JSON.stringify(fixture.identity))});localStorage.setItem(${JSON.stringify('canicas-active-'+fixture.identity.playerId)},${JSON.stringify(JSON.stringify(fixture.game))});location.href='/';}</script>`);
    return;
  }
  if (req.url.startsWith('/api/')) appendFileSync(logFile, JSON.stringify({at:Date.now(),url:req.url,mode:readMode()})+'\n');
  if (readMode() === 'offline' && req.url.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error:'Fallo de red simulado', code:'QA_OFFLINE' })); return;
  }
  const upstream = http.request({ hostname:'127.0.0.1', port:target, path:req.url, method:req.method, headers:req.headers }, incoming => {
    if (readMode() === 'drop-next-move' && req.url.endsWith('/move') && incoming.statusCode === 200) {
      incoming.resume(); writeFileSync(stateFile, JSON.stringify({ mode:'online' })); res.destroy(); return;
    }
    res.writeHead(incoming.statusCode, incoming.headers);
    if (req.url.includes('/events?')) { live.add(res); res.on('close',()=>live.delete(res)); }
    incoming.pipe(res);
  });
  upstream.on('error',()=>{ if(!res.headersSent)res.writeHead(502);res.end(); });
  res.on('close',()=>upstream.destroy());
  req.pipe(upstream);
});
server.listen(port,'127.0.0.1',()=>console.log(`QA proxy http://127.0.0.1:${port}`));
process.on('SIGINT',()=>{ clearInterval(watch); for(const res of live)res.destroy();server.close(()=>process.exit()); });
