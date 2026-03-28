import fs from 'node:fs';
import path from 'node:path';

const MAX_RUNTIME_ORIGIN_AGE_MS = 12 * 60 * 60 * 1000;

export const publicShareOriginPath = path.join(process.cwd(), 'data', 'public-share-origin.json');

type RuntimePublicShareOrigin = {
  origin?: string;
  updatedAt?: string;
};

function normalizeOrigin(rawValue: string | null | undefined): string | null {
  const candidate = rawValue?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function readRuntimeOriginFromFile(): string | null {
  try {
    const raw = fs.readFileSync(publicShareOriginPath, 'utf8');
    const parsed = JSON.parse(raw) as RuntimePublicShareOrigin;
    const normalized = normalizeOrigin(parsed.origin);
    if (!normalized) return null;

    if (parsed.updatedAt) {
      const updatedAtMs = Date.parse(parsed.updatedAt);
      if (!Number.isNaN(updatedAtMs) && Date.now() - updatedAtMs > MAX_RUNTIME_ORIGIN_AGE_MS) {
        return null;
      }
    }

    return normalized;
  } catch {
    return null;
  }
}

export function getPublicShareOrigin(): string | null {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SHARE_ORIGIN) ??
    normalizeOrigin(process.env.PUBLIC_SHARE_ORIGIN) ??
    readRuntimeOriginFromFile()
  );
}
