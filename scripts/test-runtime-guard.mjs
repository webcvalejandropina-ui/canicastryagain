import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const cwd = process.cwd();
const nextBin = join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = (modeArg?.split('=')[1] ?? 'all').toLowerCase();

const supportedModes = new Set(['prod', 'dev', 'all']);
if (!supportedModes.has(mode)) {
  console.error(`Modo inválido: ${mode}. Usa --mode=prod | --mode=dev | --mode=all`);
  process.exit(1);
}

const MAX_LOG_SIZE = 260_000;
const READY_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;

const RUNTIME_ERROR_PATTERNS = [
  /ENOENT: no such file or directory/i,
  /Cannot find module '\.\/\d+\.js'/i,
  /MODULE_NOT_FOUND/i,
  /__webpack_modules__\[moduleId\] is not a function/i,
  /Runtime Error/i,
  /\/_next\/static\/chunks\/fallback\/[^\s]*\s500\b/i
];

function appendLog(logRef, chunk) {
  const text = chunk.toString();
  const merged = logRef.value + text;
  logRef.value = merged.length > MAX_LOG_SIZE ? merged.slice(merged.length - MAX_LOG_SIZE) : merged;
}

function extractRuntimeError(logText) {
  for (const pattern of RUNTIME_ERROR_PATTERNS) {
    const match = pattern.exec(logText);
    if (match) return match[0];
  }
  return null;
}

function formatLogTail(logText) {
  const lines = logText.trim().split('\n');
  return lines.slice(Math.max(0, lines.length - 40)).join('\n');
}

function createAbortableFetchTimeout(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout)
  };
}

function httpError(status, body) {
  return `HTTP ${status}${body ? ` -> ${body.slice(0, 180).replace(/\s+/g, ' ')}` : ''}`;
}

async function request(pathname, baseUrl) {
  const timeout = createAbortableFetchTimeout(REQUEST_TIMEOUT_MS);
  try {
    return await fetch(new URL(pathname, baseUrl), {
      method: 'GET',
      redirect: 'manual',
      signal: timeout.signal
    });
  } finally {
    timeout.cleanup();
  }
}

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo obtener un puerto disponible.')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function runCommand(command, args, env, label, timeoutMs = 240_000) {
  const logRef = { value: '' };
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    appendLog(logRef, chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    appendLog(logRef, chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${label} tardó más de ${timeoutMs / 1000}s.`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`${label} falló (exit ${exitCode}).\n${formatLogTail(logRef.value)}`);
  }

  const runtimeError = extractRuntimeError(logRef.value);
  if (runtimeError) {
    throw new Error(`${label} detectó runtime error en logs: ${runtimeError}\n${formatLogTail(logRef.value)}`);
  }
}

async function startServer(command, args, env, label) {
  const logRef = { value: '' };
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    appendLog(logRef, chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    appendLog(logRef, chunk);
  });

  child.on('error', (error) => {
    console.error(`${label} error: ${error.message}`);
  });

  return { child, logRef };
}

async function stopServer(child, label) {
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(STOP_TIMEOUT_MS).then(() => false)
  ]);

  if (!exited) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('exit', () => resolve(true)));
  }

  if (child.exitCode !== 0 && child.exitCode !== null) {
    console.warn(`${label} terminó con exit ${child.exitCode}`);
  }
}

async function waitForReady(baseUrl, child, logRef, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`${label} terminó inesperadamente (exit ${child.exitCode}).\n${formatLogTail(logRef.value)}`);
    }

    const runtimeError = extractRuntimeError(logRef.value);
    if (runtimeError) {
      throw new Error(`${label} detectó runtime error en logs: ${runtimeError}\n${formatLogTail(logRef.value)}`);
    }

    try {
      const response = await request('/', baseUrl);
      if (response.status < 500) {
        return;
      }
    } catch {
      // Dev server puede tardar mientras compila.
    }

    await delay(500);
  }

  throw new Error(`${label} no quedó listo en ${READY_TIMEOUT_MS / 1000}s.\n${formatLogTail(logRef.value)}`);
}

async function assertStatus(pathname, expectedStatus, baseUrl, label) {
  const response = await request(pathname, baseUrl);
  const body = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`[${label}] ${pathname} debía responder ${expectedStatus}; ${httpError(response.status, body)}`);
  }

  if (response.status >= 500) {
    throw new Error(`[${label}] ${pathname} devolvió ${httpError(response.status, body)}`);
  }
}

async function assertNot500(pathname, baseUrl, label) {
  const response = await request(pathname, baseUrl);
  const body = await response.text();
  if (response.status >= 500) {
    throw new Error(`[${label}] ${pathname} devolvió ${httpError(response.status, body)}`);
  }
}

async function assertPathExists(pathToFile) {
  try {
    await access(pathToFile, fsConstants.F_OK);
  } catch {
    throw new Error(`Artefacto faltante: ${pathToFile}`);
  }
}

async function runProdGuard() {
  console.log('\n[guard:prod] preparando build y smoke tests...');
  const distDir = '.next-smoke-prod';
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NEXT_DIST_DIR: distDir
  };
  const standaloneServerPath = join(cwd, distDir, 'standalone', 'server.js');

  await runCommand(process.execPath, ['scripts/clean-next-cache.mjs'], env, '[guard:prod] limpieza de cache');
  await runCommand(process.execPath, [nextBin, 'build'], env, '[guard:prod] next build');
  await assertPathExists(join(cwd, distDir, 'server', 'app', 'page.js'));
  await assertPathExists(standaloneServerPath);

  const { child, logRef } = await startServer(
    process.execPath,
    [standaloneServerPath],
    {
      ...env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1'
    },
    '[guard:prod] standalone server'
  );

  try {
    await waitForReady(baseUrl, child, logRef, '[guard:prod] standalone server');
    await assertStatus('/', 200, baseUrl, 'guard:prod');
    await assertStatus('/partida-no-encontrada?code=ABC123&reason=INVALID_INVITE_TOKEN', 200, baseUrl, 'guard:prod');
    await assertStatus('/ruta-que-no-existe', 404, baseUrl, 'guard:prod');
    await assertStatus('/?code=3SJRYA&inv=cta1.invalid.token', 200, baseUrl, 'guard:prod');
    await assertNot500('/api/games/game-que-no-existe?playerId=smoke-player', baseUrl, 'guard:prod');

    const runtimeError = extractRuntimeError(logRef.value);
    if (runtimeError) {
      throw new Error(`[guard:prod] runtime error en logs: ${runtimeError}\n${formatLogTail(logRef.value)}`);
    }
  } finally {
    await stopServer(child, '[guard:prod] standalone server');
  }

  console.log('[guard:prod] ok');
}

async function runDevGuard() {
  console.log('\n[guard:dev] preparando smoke tests de dev...');
  const distDir = '.next-smoke-dev';
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NEXT_DIST_DIR: distDir
  };

  await runCommand(process.execPath, ['scripts/clean-next-cache.mjs'], env, '[guard:dev] limpieza de cache');
  const { child, logRef } = await startServer(
    process.execPath,
    [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    env,
    '[guard:dev] next dev'
  );

  try {
    await waitForReady(baseUrl, child, logRef, '[guard:dev] next dev');
    await assertStatus('/', 200, baseUrl, 'guard:dev');
    await assertStatus('/partida-no-encontrada?code=ABC123&reason=INVALID_INVITE_TOKEN', 200, baseUrl, 'guard:dev');
    await assertStatus('/ruta-que-no-existe', 404, baseUrl, 'guard:dev');
    await assertStatus('/?code=3SJRYA&inv=cta1.invalid.token', 200, baseUrl, 'guard:dev');
    await assertNot500('/_next/static/chunks/fallback/webpack.js', baseUrl, 'guard:dev');
    await assertNot500('/_next/static/chunks/fallback/react-refresh.js', baseUrl, 'guard:dev');
    await assertNot500('/_next/static/chunks/fallback/main.js', baseUrl, 'guard:dev');
    await assertNot500('/_next/static/chunks/fallback/pages/_app.js', baseUrl, 'guard:dev');
    await assertNot500('/_next/static/chunks/fallback/pages/_error.js', baseUrl, 'guard:dev');

    await delay(800);
    await assertPathExists(join(cwd, distDir, 'server', 'app', 'page.js'));

    const runtimeError = extractRuntimeError(logRef.value);
    if (runtimeError) {
      throw new Error(`[guard:dev] runtime error en logs: ${runtimeError}\n${formatLogTail(logRef.value)}`);
    }
  } finally {
    await stopServer(child, '[guard:dev] next dev');
  }

  console.log('[guard:dev] ok');
}

async function main() {
  await access(nextBin, fsConstants.F_OK).catch(() => {
    throw new Error(`No se encontró Next CLI en: ${nextBin}. Ejecuta npm install.`);
  });

  if (mode === 'prod' || mode === 'all') {
    await runProdGuard();
  }
  if (mode === 'dev' || mode === 'all') {
    await runDevGuard();
  }

  console.log('\n✅ Guard de runtime completado sin errores.');
}

main().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
});
