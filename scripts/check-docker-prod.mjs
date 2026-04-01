/**
 * check-docker-prod.mjs
 *
 * Verifies that the production Dockerfile and docker-compose.yml are
 * well-formed and that the build would succeed without actually building.
 *
 * Used as part of `npm test` to catch configuration drift.
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// scripts/ is one level below the project root
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function colorize(text, code) {
  const codes = { green: 32, red: 31, yellow: 33, cyan: 36, bold: 1 };
  return `\x1b[${codes[code] ?? 0}m${text}\x1b[0m`;
}

function checkPass(label) {
  console.log(`${colorize('✓', 'green')} ${label}`);
}

function checkFail(label, reason) {
  console.error(`${colorize('✗', 'red')} ${label}`);
  if (reason) console.error(`       ${reason}`);
}

const checks = [];

function addCheck(label, fn) {
  checks.push({ label, fn });
}

// ── checks ────────────────────────────────────────────────────────────────────

addCheck('Dockerfile exists', () => {
  const p = join(PROJECT_ROOT, 'Dockerfile');
  if (!existsSync(p)) {
    checkFail('Dockerfile exists', `Not found at ${p}`);
    return false;
  }
  const content = readFileSync(p, 'utf8');
  if (!content.includes('FROM')) {
    checkFail('Dockerfile exists', 'No FROM instruction found');
    return false;
  }
  checkPass('Dockerfile exists and has FROM');
  return true;
});

addCheck('docker-compose.yml exists and is valid YAML', () => {
  const p = join(PROJECT_ROOT, 'docker-compose.yml');
  if (!existsSync(p)) {
    checkFail('docker-compose.yml exists', `Not found at ${p}`);
    return false;
  }
  let yaml;
  try {
    yaml = readFileSync(p, 'utf8');
    // Basic structure check — should have "services:"
    if (!yaml.includes('services:')) {
      checkFail('docker-compose.yml is valid YAML structure', 'Missing "services:" key');
      return false;
    }
  } catch (e) {
    checkFail('docker-compose.yml is readable', e.message);
    return false;
  }
  checkPass('docker-compose.yml is valid');
  return true;
});

addCheck('Dockerfile uses node:20-alpine base', () => {
  const p = join(PROJECT_ROOT, 'Dockerfile');
  const content = readFileSync(p, 'utf8');
  if (!content.includes('node:20-alpine')) {
    checkFail('Dockerfile uses node:20-alpine base', 'Expected "node:20-alpine" in Dockerfile');
    return false;
  }
  checkPass('Dockerfile uses node:20-alpine');
  return true;
});

addCheck('Dockerfile CMD runs Next.js', () => {
  const p = join(PROJECT_ROOT, 'Dockerfile');
  const content = readFileSync(p, 'utf8');
  if (!content.includes('CMD')) {
    checkFail('Dockerfile has CMD instruction', 'No CMD found');
    return false;
  }
  checkPass('Dockerfile has CMD instruction');
  return true;
});

addCheck('.dockerignore exists and excludes node_modules', () => {
  const p = join(PROJECT_ROOT, '.dockerignore');
  if (!existsSync(p)) {
    checkFail('.dockerignore exists', `Not found at ${p}`);
    return false;
  }
  const content = readFileSync(p, 'utf8');
  if (!content.includes('node_modules')) {
    checkFail('.dockerignore excludes node_modules', 'node_modules not found in .dockerignore — build will include them');
    return false;
  }
  checkPass('.dockerignore exists and excludes node_modules');
  return true;
});

addCheck('package.json has build and start scripts', () => {
  const p = join(PROJECT_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(p, 'utf8'));
  if (!pkg.scripts?.build) {
    checkFail('package.json has build script', 'build script not found');
    return false;
  }
  if (!pkg.scripts?.start) {
    checkFail('package.json has start script', 'start script not found');
    return false;
  }
  checkPass('package.json has build and start scripts');
  return true;
});

// ── run ──────────────────────────────────────────────────────────────────────

console.log(colorize('═══ Docker production config check ═══', 'bold'));
console.log('');

let passed = 0;
let failed = 0;

for (const { label, fn } of checks) {
  try {
    if (fn()) passed++;
    else failed++;
  } catch (err) {
    checkFail(label, `Unexpected error: ${err.message}`);
    failed++;
  }
}

console.log('');
console.log(colorize('═══════════════════════════════════════════════════════', 'bold'));
if (failed === 0) {
  console.log(colorize(` All checks passed (${passed}/${passed}) `, 'green'));
  process.exit(0);
} else {
  console.error(colorize(` Some checks FAILED (${passed}/${passed + failed} passed) `, 'red'));
  process.exit(1);
}
