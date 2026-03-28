import { createHmac, timingSafeEqual } from 'node:crypto';

import { AppError } from '@/backend/shared/domain/AppError';

type InviteTokenPayload = {
  code: string;
  version: number;
};

const TOKEN_PREFIX = 'cta1';
const DEFAULT_SECRET = 'canicas-try-again-dev-secret-change-me';

function getSecret(): string {
  return process.env.INVITE_TOKEN_SECRET?.trim() || DEFAULT_SECRET;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payloadSegment: string): string {
  const secret = getSecret();
  return createHmac('sha256', secret).update(payloadSegment).digest('base64url');
}

export function encodeInviteToken(gameCode: string, inviteVersion: number): string {
  const payload: InviteTokenPayload = {
    code: gameCode,
    version: inviteVersion
  };

  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signatureSegment = sign(payloadSegment);

  return `${TOKEN_PREFIX}.${payloadSegment}.${signatureSegment}`;
}

export function decodeInviteToken(inviteToken: string): InviteTokenPayload {
  const normalizedToken = inviteToken.trim();
  if (!normalizedToken) {
    throw new AppError('Token de invitación inválido', 400, 'INVALID_INVITE_TOKEN');
  }

  const parts = normalizedToken.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    throw new AppError('Token de invitación inválido', 400, 'INVALID_INVITE_TOKEN');
  }

  const payloadSegment = parts[1];
  const providedSignature = parts[2];
  const expectedSignature = sign(payloadSegment);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new AppError('Token de invitación inválido', 400, 'INVALID_INVITE_TOKEN');
  }

  let payload: InviteTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadSegment)) as InviteTokenPayload;
  } catch {
    throw new AppError('Token de invitación inválido', 400, 'INVALID_INVITE_TOKEN');
  }

  const code = payload.code?.trim().toUpperCase() ?? '';
  const version = Number.isInteger(payload.version) ? payload.version : Number(payload.version);

  if (!code || !Number.isInteger(version) || version < 1) {
    throw new AppError('Token de invitación inválido', 400, 'INVALID_INVITE_TOKEN');
  }

  return {
    code,
    version
  };
}
