export const PRIVATE_INVITE_TTL_MS = 5 * 60 * 1000;

export function isPrivateInvite(token: string): boolean {
  return /^cta2\.[A-Za-z0-9_-]{43}$/.test(token);
}

// Web Crypto keeps the shared game domain usable by the offline practice client.
// Private games are created on the server; no weak random fallback is allowed.
export function createPrivateInvite(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `cta2.${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export function matchesPrivateInvite(expected: string, provided: string): boolean {
  if (!isPrivateInvite(expected) || !isPrivateInvite(provided)) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}
