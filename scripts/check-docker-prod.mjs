#!/usr/bin/env node
/**
 * Comprueba que Docker use producción (node server.js), no run dev.
 * Uso: node scripts/check-docker-prod.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
let failed = false;

// 1. Dockerfile: CMD debe ser node server.js
const dockerfilePath = join(cwd, 'Dockerfile');
const dockerfile = readFileSync(dockerfilePath, 'utf-8');
const hasNodeServer = /CMD\s+\[[\s\n]*["']node["'],\s*["']server\.js["']\s*\]/.test(dockerfile);
const hasRunDev = /npm\s+run\s+dev|next\s+dev/.test(dockerfile);

if (!hasNodeServer) {
  console.error('❌ Dockerfile: CMD debe ser ["node", "server.js"] (producción).');
  failed = true;
}
if (hasRunDev) {
  console.error('❌ Dockerfile: no debe contener "npm run dev" ni "next dev".');
  failed = true;
}
if (hasNodeServer && !hasRunDev) {
  console.log('✅ Dockerfile: CMD es node server.js (producción).');
}

// 2. docker-compose.yml: app no debe tener command que ejecute dev
const composePath = join(cwd, 'docker-compose.yml');
const compose = readFileSync(composePath, 'utf-8');
const appSection = compose.replace(/\r\n/g, '\n');
const hasDevInCompose = /next\s+dev|npm\s+run\s+dev|next dev/.test(appSection);

if (hasDevInCompose) {
  console.error('❌ docker-compose.yml: el servicio app no debe ejecutar "next dev" ni "npm run dev".');
  failed = true;
} else {
  console.log('✅ docker-compose.yml: no ejecuta run dev.');
}

if (failed) {
  process.exit(1);
}
console.log('');
console.log('Docker está configurado para producción (node server.js).');
process.exit(0);
