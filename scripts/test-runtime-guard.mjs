/**
 * test-runtime-guard.mjs
 *
 * Runtime smoke-test for Canicas Try Again.
 * Starts the Next.js server (dev or prod), waits for it to be ready,
 * makes HTTP requests to verify core endpoints respond correctly,
 * then stops the server.
 *
 * Usage:
 *   node scripts/test-runtime-guard.mjs --mode=dev
 *   node scripts/test-runtime-guard.mjs --mode=prod
 *   node scripts/test-runtime-guard.mjs --mode=all   (runs both)
 *
 * Exit codes:
 *   0  — all checks passed
 *   1  — server failed to start or check failed
 *   2  — invalid --mode argument
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';

// scripts/ is one level below the project root
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 13777; // Non-standard port to avoid conflicts

// ── helpers ──────────────────────────────────────────────────────────────────

function colorize(text, code) {
  const codes = { green: 32, red: 31, yellow: 33, cyan: 36, bold: 1 };
  return `\x1b[${codes[code] ?? 0}m${text}\x1b[0m`;
}

function log(mode, msg) {
  const prefix = colorize(`[${mode.toUpperCase()}]`, 'cyan');
  console.log(`${prefix} ${msg}`);
}

function logPass(mode, msg) {
  console.log(`${colorize('✓', 'green')} ${colorize(`[${mode.toUpperCase()}]`, 'cyan')} ${msg}`);
}

function logFail(mode, msg) {
  console.error(`${colorize('✗', 'red')} ${colorize(`[${mode.toUpperCase()}]`, 'cyan')} ${msg}`);
}

// ── server lifecycle ────────────────────────────────────────────────────────────

/**
 * Starts the Next.js server as a child process and resolves once it is ready.
 * Returns the child process handle.
 */
function startServer(mode) {
  return new Promise((resolve, reject) => {
    const isProd = mode === 'prod';
    const label = isProd ? 'next start' : `next dev (${mode})`;

    log(mode, `Starting ${label} on port ${PORT}…`);

    const env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: isProd ? 'production' : 'development',
      NEXT_TELEMETRY_DISABLED: '1',
      // Use the existing dev SQLite DB so the server can start without migrate
      SQLITE_PATH: join(PROJECT_ROOT, 'data/game.db'),
    };

    const serverBin = isProd
      ? join(PROJECT_ROOT, 'node_modules/.bin/next')
      : join(PROJECT_ROOT, 'node_modules/.bin/next');

    const args = isProd ? ['start'] : ['dev', '--port', String(PORT), '--no-lint'];

    const child = spawn(serverBin, args, {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    // Timeout: give the server at most 60 s to be ready
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Server startup timed out after 60 s\nLast stdout:\n${stdout.slice(-1000)}`));
    }, 60_000);

    // Resolve once we see the "Ready" / "started server" message
    const checkReady = (chunk) => {
      const text = chunk.toString();
      if (
        /- Local:/.test(text) ||
        /- ready on/i.test(text) ||
        /HTTP\s+:\/\//.test(text) ||
        /Compiling/i.test(text)  // dev mode prints "Compiling…" — wait a bit more
      ) {
        // For dev mode "Compiling" we need the final ready message
        if (/ready on|Local:/.test(text)) {
          clearTimeout(timeout);
          child.stdout?.removeListener('data', checkReady);
          resolve(child);
        }
      }
    };

    // Poll every 500 ms for up to 60 s
    const poll = setInterval(() => {
      // Look for ready signal in buffered output
      if (/ready on|Local:/.test(stdout)) {
        clearTimeout(timeout);
        clearInterval(poll);
        child.stdout?.removeListener('data', checkReady);
        resolve(child);
      } else if (/Error|error|warn.*cannot/i.test(stderr)) {
        // Surface real errors early
        clearTimeout(timeout);
        clearInterval(poll);
        child.stderr?.removeListener('data', () => {});
        reject(new Error(`Server emitted error during startup:\n${stderr.slice(-2000)}`));
      }
    }, 500);

    child.stdout.on('data', checkReady);

    child.on('error', (err) => {
      clearTimeout(timeout);
      clearInterval(poll);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      clearInterval(poll);
      if (code !== 0 && signal !== 'SIGTERM') {
        reject(new Error(`Server exited unexpectedly (code=${code}, signal=${signal})\nStdout:\n${stdout.slice(-1000)}\nStderr:\n${stderr.slice(-1000)}`));
      }
    });
  });
}

/**
 * Stops the server gracefully via SIGTERM, then SIGKILL if needed.
 */
async function stopServer(child) {
  return new Promise((resolve) => {
    child.kill('SIGTERM');
    const fallback = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.on('exit', () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

// ── HTTP checks ───────────────────────────────────────────────────────────────

async function httpGet(url, expectedStatus = 200) {
  const res = await fetch(url);
  if (res.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, got ${res.status} for ${url}`);
  }
  return res;
}

async function checkEndpoints(mode, baseUrl) {
  const checks = [
    { url: `${baseUrl}/`, expectedStatus: 200, label: 'Home page (/) returns 200' },
    { url: `${baseUrl}/api/runtime-config`, expectedStatus: 200, label: 'Runtime config API returns 200' },
    { url: `${baseUrl}/api/rankings`, expectedStatus: 200, label: 'Rankings API returns 200' },
    { url: `${baseUrl}/nonexistent-page-xyz`, expectedStatus: 404, label: '404 page returns 404' },
  ];

  let passed = 0;
  let failed = 0;

  for (const { url, expectedStatus: exp, label } of checks) {
    try {
      await httpGet(url, exp);
      logPass(mode, label);
      passed++;
    } catch (err) {
      logFail(mode, `${label} — ${err.message}`);
      failed++;
    }
  }

  return { passed, failed };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function runMode(mode) {
  log(mode, '── Runtime guard start ──────────────────────────────');

  // Verify the build exists before starting prod server
  if (mode === 'prod') {
    const standaloneServer = join(PROJECT_ROOT, '.next/standalone/server.js');
    if (!existsSync(standaloneServer)) {
      logFail(mode, `.next/standalone/server.js not found — run "npm run build" first`);
      return { passed: 0, failed: 1, mode };
    }
    log(mode, 'Build artifacts verified (.next/standalone present)');
  }

  let child;
  try {
    child = await startServer(mode);
    const baseUrl = `http://localhost:${PORT}`;
    log(mode, `Server ready. Running endpoint checks against ${baseUrl}…`);
    await sleep(1_000); // Extra settle time for dev compilation
    const result = await checkEndpoints(mode, baseUrl);
    return result;
  } finally {
    if (child) {
      log(mode, 'Stopping server…');
      await stopServer(child);
      log(mode, 'Server stopped.');
    }
    log(mode, '── Runtime guard end ────────────────────────────────');
    console.log('');
  }
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v = 'true'] = a.startsWith('--') ? [a.slice(2), undefined] : [a, undefined];
      return [k, v];
    })
  );

  const mode = args.mode ?? 'all';
  const validModes = ['dev', 'prod', 'all'];

  if (!validModes.includes(mode)) {
    console.error(`Invalid --mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
    process.exit(2);
  }

  let totalPassed = 0;
  let totalFailed = 0;

  const modesToRun = mode === 'all' ? ['dev', 'prod'] : [mode];

  for (const m of modesToRun) {
    const { passed, failed } = await runMode(m);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log(colorize('═══════════════════════════════════════════════════════', 'bold'));
  if (totalFailed === 0) {
    console.log(colorize(` All checks passed (${totalPassed}/${totalPassed}) `, 'green'));
    process.exit(0);
  } else {
    console.error(colorize(` Some checks FAILED (${totalPassed}/${totalPassed + totalFailed} passed) `, 'red'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(colorize(`Fatal: ${err.message}`, 'red'));
  process.exit(1);
});
