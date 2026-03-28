import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const cwd = process.cwd();
const nextBin = path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');
const runtimeOriginPath = path.join(cwd, 'data', 'public-share-origin.json');

let shuttingDown = false;
let nextProcess = null;
let tunnelProcess = null;

function prefixLine(label, line) {
  process.stdout.write(`[${label}] ${line}\n`);
}

function cleanupRuntimeOriginFile() {
  fs.rmSync(runtimeOriginPath, { force: true });
}

function writeRuntimeOriginFile(origin) {
  fs.mkdirSync(path.dirname(runtimeOriginPath), { recursive: true });
  fs.writeFileSync(
    runtimeOriginPath,
    JSON.stringify(
      {
        origin,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n'
  );
}

function attachLogger(stream, label, onLine) {
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    prefixLine(label, line);
    onLine?.(line);
  });
  return rl;
}

function waitForNextReady(child) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      child.off('exit', handleExit);
      stdoutRl.close();
      stderrRl.close();
      handler(value);
    };

    const handleExit = (code, signal) => {
      finish(reject, new Error(`next dev se cerró antes de estar listo (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    };

    const onLine = (line) => {
      if (line.includes('Ready in')) {
        finish(resolve);
      }
    };

    const stdoutRl = attachLogger(child.stdout, 'next', onLine);
    const stderrRl = attachLogger(child.stderr, 'next', onLine);

    child.once('exit', handleExit);
  });
}

function waitForTunnelUrl(child) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      child.off('exit', handleExit);
      stdoutRl.close();
      stderrRl.close();
      handler(value);
    };

    const handleExit = (code, signal) => {
      finish(reject, new Error(`cloudflared se cerró antes de entregar la URL publica (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    };

    const onLine = (line) => {
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        finish(resolve, match[0]);
      }
    };

    const stdoutRl = attachLogger(child.stdout, 'tunnel', onLine);
    const stderrRl = attachLogger(child.stderr, 'tunnel', onLine);

    child.once('exit', handleExit);
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  cleanupRuntimeOriginFile();

  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 300);
}

async function main() {
  cleanupRuntimeOriginFile();

  nextProcess = spawn(nextBin, ['dev', '--hostname', '0.0.0.0', '--port', '3000'], {
    cwd,
    env: {
      ...process.env,
      NEXT_DIST_DIR: '.next-dev-public'
    },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  nextProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`next dev terminó inesperadamente (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
      shutdown(code ?? 1);
    }
  });

  nextProcess.on('error', (error) => {
    if (!shuttingDown) {
      console.error(`No se pudo iniciar next dev: ${error.message}`);
      shutdown(1);
    }
  });

  await waitForNextReady(nextProcess);

  tunnelProcess = spawn(
    'cloudflared',
    ['tunnel', '--url', 'http://127.0.0.1:3000', '--protocol', 'http2', '--edge-ip-version', '4', '--no-autoupdate'],
    {
      cwd,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe']
    }
  );

  tunnelProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`cloudflared terminó inesperadamente (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
      shutdown(code ?? 1);
    }
  });

  tunnelProcess.on('error', (error) => {
    if (!shuttingDown) {
      console.error(`No se pudo iniciar cloudflared: ${error.message}`);
      shutdown(1);
    }
  });

  const publicOrigin = await waitForTunnelUrl(tunnelProcess);
  writeRuntimeOriginFile(publicOrigin);

  process.stdout.write('\n');
  process.stdout.write(`URL publica: ${publicOrigin}\n`);
  process.stdout.write('Usa esta URL tanto en el ordenador como en el movil para crear y unirte a partidas.\n');
  process.stdout.write('Mientras este proceso siga vivo, el boton "Invitar" en localhost usara esa URL publica.\n');
  process.stdout.write('\n');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  if (!shuttingDown) {
    cleanupRuntimeOriginFile();
  }
});

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
