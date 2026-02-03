import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function canonicalInternalBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body == null) return '{}';
  return JSON.stringify(body);
}

export function internalBodyHash(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function buildInternalSignaturePayload(input: {
  ts: string;
  method: string;
  path: string;
  bodyHash: string;
}): string {
  return `${input.ts}:${input.method.toUpperCase()}:${input.path}:${input.bodyHash}`;
}

export function computeInternalSignature(input: {
  ts: string;
  method: string;
  path: string;
  bodyHash: string;
  secret: string;
}): string {
  const payload = buildInternalSignaturePayload(input);
  return createHmac('sha256', input.secret).update(payload).digest('hex');
}

export function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(providedHex, 'hex'));
  } catch {
    return false;
  }
}
