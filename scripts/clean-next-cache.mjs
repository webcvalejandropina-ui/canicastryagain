import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const explicitDistDir = process.env.NEXT_DIST_DIR?.trim();
const cleanAll = process.env.CLEAN_ALL_NEXT_DIRS === '1';
const defaultDistDir = '.next';

const candidateDirs = new Set();

if (cleanAll) {
  candidateDirs.add('.next');
  candidateDirs.add('.next-dev');
  candidateDirs.add('.next-smoke-dev');
  candidateDirs.add('.next-smoke-prod');
} else if (explicitDistDir) {
  candidateDirs.add(explicitDistDir);
} else {
  candidateDirs.add(defaultDistDir);
}

for (const dirName of candidateDirs) {
  if (!dirName || !dirName.startsWith('.next')) continue;
  const target = resolve(cwd, dirName);
  rmSync(target, { recursive: true, force: true });
}
