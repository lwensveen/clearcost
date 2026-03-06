import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { apiKeysTable, db } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import {
  BinaryLike,
  createHash,
  randomBytes,
  scrypt as scryptCb,
  ScryptOptions,
  timingSafeEqual,
} from 'node:crypto';
import { errorResponseForStatus } from '../lib/errors.js';
import {
  canonicalInternalBody,
  computeInternalSignature,
  internalBodyHash,
  timingSafeHexEqual,
} from '../lib/internal-signing.js';
import { isDemoKey } from '../modules/api-keys/services/is-demo-key.js';

function scryptAsync(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

// Token format:  ck_<prefix>_<keyId>.<secret>
const TOKEN_RE = /^ck_([a-z0-9-]+)_([A-Za-z0-9_-]{6,32})\.([A-Za-z0-9_-]{16,})$/i;

function sha256Hex(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Generate a user-facing API token and the PHC-encoded scrypt hash for storage. */
export async function generateApiKey(prefix: 'live' | 'test' = 'live') {
  const keyId = randomBytes(8).toString('base64url'); // public id
  const secret = randomBytes(24).toString('base64url'); // secret chunk
  const token = `ck_${prefix}_${keyId}.${secret}`;
  const tokenPhc = await hashApiKeySecretForStorage(secret, PEPPER);
  return { token, keyId, secret, tokenPhc, prefix };
}

/** PHC string helpers (scrypt) */
type ScryptParams = { N: number; r: number; p: number; dkLen: number };

const DEFAULT_SCRYPT: ScryptParams = {
  N: 1 << 15, // 32768 (ln=15)
  r: 8,
  p: 1,
  dkLen: 32,
};

function toPhc({ N, r, p }: ScryptParams, salt: Buffer, hash: Buffer): string {
  const ln = Math.log2(N) | 0;
  return `$scrypt$ln=${ln},r=${r},p=${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function expectGroup(m: RegExpMatchArray, idx: number, label: string): string {
  const v = m[idx];
  if (v == null) throw new Error(`Invalid PHC: missing ${label}`);
  return v;
}

function parsePhc(phc: string): { params: ScryptParams; salt: Buffer; hash: Buffer } {
  const m = phc.match(/^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/);
  if (!m) throw new Error('Invalid PHC');

  const lnStr = expectGroup(m, 1, 'ln');
  const rStr = expectGroup(m, 2, 'r');
  const pStr = expectGroup(m, 3, 'p');
  const saltB64 = expectGroup(m, 4, 'salt');
  const hashB64 = expectGroup(m, 5, 'hash');

  const N = 1 << parseInt(lnStr, 10);
  const r = parseInt(rStr, 10);
  const p = parseInt(pStr, 10);
  const salt = Buffer.from(saltB64, 'base64');
  const hash = Buffer.from(hashB64, 'base64');

  return { params: { N, r, p, dkLen: hash.length }, salt, hash };
}

async function kdfScrypt(secret: string, params: ScryptParams, salt: Buffer): Promise<Buffer> {
  return await scryptAsync(secret, salt, params.dkLen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 64 * 1024 * 1024,
  });
}

/** Create a PHC string for storage using scrypt (secret + pepper). */
export async function hashApiKeySecretForStorage(secret: string, pepper: string): Promise<string> {
  const params = DEFAULT_SCRYPT;
  const salt = randomBytes(16);
  const dk = await kdfScrypt(`${secret}|${pepper}`, params, salt);
  return toPhc(params, salt, dk);
}

async function verifyTokenPhc(secret: string, pepper: string, phc: string): Promise<boolean> {
  const { params, salt, hash } = parsePhc(phc);
  const dk = await kdfScrypt(`${secret}|${pepper}`, params, salt);
  if (dk.length !== hash.length) return false;
  try {
    return timingSafeEqual(dk, hash);
  } catch {
    return false;
  }
}

type ParsedToken = {
  prefix: 'live' | 'test' | (string & {});
  keyId: string;
  secret: string;
  raw: string;
};

function parsePresentedToken(hdr?: string | string[] | null): ParsedToken | null {
  const raw = Array.isArray(hdr) ? hdr[0] : hdr;
  if (!raw) return null;
  const v = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  const m = TOKEN_RE.exec(v);
  if (!m) return null;
  const prefix = (m[1] ?? '') as ParsedToken['prefix'];
  const keyId = m[2] ?? '';
  const secret = m[3] ?? '';
  if (!prefix || !keyId || !secret) return null;
  return { prefix, keyId, secret, raw: v };
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: {
      id: string;
      ownerId: string;
      scopes: string[];
      keyId: string;
      prefix: string;
      isDemo?: boolean;
      rateLimitPerMin?: number | null;
      allowedOrigins?: string[];
    };
  }
  interface FastifyInstance {
    requireApiKey: (
      requiredScopes?: string[],
      opts?: {
        ownerFrom?: (req: FastifyRequest) => string | undefined;
        optional?: boolean;
        internalSigned?: boolean;
      }
    ) => preHandlerHookHandler;
    requireInternalSignature: () => preHandlerHookHandler;
  }
}

type RequireApiKeyOptions = {
  ownerFrom?: (req: FastifyRequest) => string | undefined;
  optional?: boolean;
  internalSigned?: boolean;
};

// ── Per-key rate limiting (fixed-window, in-memory) ─────────────────────
const keyRateLimitCounters = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60_000; // 1 minute

function isKeyRateLimited(keyId: string, limit: number): boolean {
  const now = Date.now();
  const entry = keyRateLimitCounters.get(keyId);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    keyRateLimitCounters.set(keyId, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

// Periodic cleanup of stale rate-limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of keyRateLimitCounters) {
    if (now - entry.windowStart >= WINDOW_MS * 2) {
      keyRateLimitCounters.delete(key);
    }
  }
}, WINDOW_MS * 2).unref();

// ── API-key verification cache (short-lived, avoids scrypt on every request) ──
const AUTH_CACHE_TTL_MS = 30_000; // 30 seconds
const AUTH_CACHE_MAX_SIZE = 1000;

type AuthCacheEntry = {
  apiKey: NonNullable<FastifyRequest['apiKey']>;
  expiresAt: number;
};
const authCache = new Map<string, AuthCacheEntry>();

function authCacheGet(tokenHash: string): AuthCacheEntry['apiKey'] | null {
  const entry = authCache.get(tokenHash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(tokenHash);
    return null;
  }
  return entry.apiKey;
}

function authCacheSet(tokenHash: string, apiKey: AuthCacheEntry['apiKey']): void {
  // Evict oldest entries if cache is full
  if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
    const firstKey = authCache.keys().next().value;
    if (firstKey) authCache.delete(firstKey);
  }
  authCache.set(tokenHash, { apiKey, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authCache) {
    if (now > entry.expiresAt) {
      authCache.delete(key);
    }
  }
}, AUTH_CACHE_TTL_MS).unref();

// ── Buffered lastUsedAt updates (once per key per minute) ───────────────
const LAST_USED_BUFFER_MS = 60_000; // 1 minute
const lastUsedAtBuffer = new Map<string, number>(); // apiKeyId -> lastFlushedTs

function shouldUpdateLastUsedAt(apiKeyId: string): boolean {
  const now = Date.now();
  const last = lastUsedAtBuffer.get(apiKeyId);
  if (last && now - last < LAST_USED_BUFFER_MS) return false;
  lastUsedAtBuffer.set(apiKeyId, now);
  return true;
}

// Periodic cleanup of stale lastUsedAt buffer entries
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of lastUsedAtBuffer) {
    if (now - ts >= LAST_USED_BUFFER_MS * 5) {
      lastUsedAtBuffer.delete(key);
    }
  }
}, LAST_USED_BUFFER_MS * 5).unref();

// Definite string to avoid TS2345
const PEPPER: string = process.env.API_KEY_PEPPER ?? '';
const INTERNAL_SIGNING_SECRET: string = process.env.INTERNAL_SIGNING_SECRET ?? '';

export const apiKeyAuthPlugin: FastifyPluginAsync = fp(
  async (app: FastifyInstance) => {
    if (process.env.NODE_ENV === 'production' && !PEPPER) {
      throw new Error('API_KEY_PEPPER must be set in production');
    }

    if (process.env.NODE_ENV !== 'production' && !PEPPER) {
      app.log.warn(
        'API_KEY_PEPPER is not set — API key hashing is running without a pepper. Set API_KEY_PEPPER for production-equivalent security.'
      );
    }

    if (process.env.NODE_ENV === 'production' && !INTERNAL_SIGNING_SECRET) {
      throw new Error('INTERNAL_SIGNING_SECRET must be set in production');
    }

    if (process.env.NODE_ENV !== 'production' && !INTERNAL_SIGNING_SECRET) {
      app.log.warn(
        'INTERNAL_SIGNING_SECRET is not set — internal request signing is disabled. Set INTERNAL_SIGNING_SECRET for production-equivalent security.'
      );
    }

    function verifyInternalSignature(req: FastifyRequest): boolean {
      if (!INTERNAL_SIGNING_SECRET) return true;

      const tsHdr = req.headers['x-cc-ts'];
      const sigHdr = req.headers['x-cc-sig'];
      if (typeof tsHdr !== 'string' || typeof sigHdr !== 'string') return false;

      const tsNum = Number(tsHdr);
      const skewMs = Math.abs(Date.now() - tsNum);
      if (!Number.isFinite(skewMs) || skewMs > 5 * 60 * 1000) return false;

      const bodyStr = canonicalInternalBody(req.body);
      const bodyHash = internalBodyHash(bodyStr);
      const method = String(req.method || 'GET').toUpperCase();

      const variants = new Set<string>();

      const url1 = String((req as unknown as { url?: string }).url ?? '');
      if (url1) variants.add(url1);

      const rawUrl = (req.raw as { url?: unknown }).url;
      const url2 = typeof rawUrl === 'string' ? rawUrl : '';
      if (url2) variants.add(url2);

      // Canonicalize: path + sorted query from req.query (if available)
      try {
        const pathOnly = (url1 || url2).split('?')[0] || '';
        const qs = req.query
          ? new URLSearchParams(req.query as Record<string, string>).toString()
          : '';
        variants.add(qs ? `${pathOnly}?${qs}` : pathOnly);
      } catch {
        /* ignore canonicalization errors */
      }

      for (const u of variants) {
        const expectedHex = computeInternalSignature({
          ts: tsHdr,
          method,
          path: u,
          bodyHash,
          secret: INTERNAL_SIGNING_SECRET,
        });
        if (timingSafeHexEqual(expectedHex, sigHdr)) return true;
      }
      return false;
    }

    app.decorate(
      'requireApiKey',
      (requiredScopes: string[] = [], opts: RequireApiKeyOptions = {}) => {
        return async (req: FastifyRequest, reply: FastifyReply) => {
          if (opts.internalSigned === true && !verifyInternalSignature(req)) {
            return reply.code(401).send(errorResponseForStatus(401, 'Invalid internal signature'));
          }

          const authHdr = req.headers['authorization'] as string | undefined;
          const apiHdr = req.headers['x-api-key'] as string | undefined;
          const presented = parsePresentedToken(authHdr ?? apiHdr);

          if (!presented) {
            if (opts.optional) return;
            return reply
              .code(401)
              .send(errorResponseForStatus(401, 'Missing or malformed API key'));
          }

          const { keyId, secret, prefix: presentedPrefix } = presented;
          const tokenHash = sha256Hex(Buffer.from(presented.raw));

          // ── Check auth cache (avoids DB + scrypt on every request) ──
          const cached = authCacheGet(tokenHash);
          if (cached) {
            req.apiKey = cached;

            // Still enforce scopes, owner, origin, and rate limit for cached entries
            if (requiredScopes.length) {
              const has = requiredScopes.every(
                (s) => cached.scopes.includes(s) || cached.scopes.includes('admin:all')
              );
              if (!has)
                return reply
                  .code(403)
                  .send(errorResponseForStatus(403, 'Missing required scope(s)'));
            }

            const ownerFrom = opts.ownerFrom?.(req);
            if (ownerFrom && cached.ownerId !== ownerFrom && !cached.scopes.includes('admin:all')) {
              return reply.code(403).send(errorResponseForStatus(403, 'Owner mismatch'));
            }

            const reqOrigin =
              typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
            if (
              cached.allowedOrigins?.length &&
              reqOrigin &&
              !cached.scopes.includes('admin:all')
            ) {
              if (!cached.allowedOrigins.includes(reqOrigin))
                return reply.code(403).send(errorResponseForStatus(403, 'Origin not allowed'));
            }

            if (cached.rateLimitPerMin && isKeyRateLimited(cached.keyId, cached.rateLimitPerMin)) {
              return reply.code(429).send(errorResponseForStatus(429, 'Rate limit exceeded'));
            }

            return;
          }

          // ── Full DB lookup + scrypt verification ──
          const rows = await db
            .select()
            .from(apiKeysTable)
            .where(and(eq(apiKeysTable.keyId, keyId), eq(apiKeysTable.isActive, true)))
            .limit(1);
          const row = rows[0];
          if (!row) return reply.code(401).send(errorResponseForStatus(401, 'Invalid API key'));

          if (row.prefix && row.prefix !== presentedPrefix)
            return reply.code(401).send(errorResponseForStatus(401, 'Invalid API key'));
          if (row.expiresAt && row.expiresAt < new Date())
            return reply.code(401).send(errorResponseForStatus(401, 'API key expired'));
          if (row.revokedAt)
            return reply.code(401).send(errorResponseForStatus(401, 'API key revoked'));

          if (!row.tokenPhc)
            return reply.code(401).send(errorResponseForStatus(401, 'Invalid API key'));
          const ok = await verifyTokenPhc(secret, PEPPER, row.tokenPhc);
          if (!ok) return reply.code(401).send(errorResponseForStatus(401, 'Invalid API key'));

          const scopes = row.scopes ?? [];
          const allowedOrigins = row.allowedOrigins ?? [];

          if (requiredScopes.length) {
            const has = requiredScopes.every(
              (s) => scopes.includes(s) || scopes.includes('admin:all')
            );
            if (!has)
              return reply.code(403).send(errorResponseForStatus(403, 'Missing required scope(s)'));
          }

          const ownerFrom = opts.ownerFrom?.(req);
          if (ownerFrom && row.ownerId !== ownerFrom && !scopes.includes('admin:all')) {
            return reply.code(403).send(errorResponseForStatus(403, 'Owner mismatch'));
          }

          const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
          if (allowedOrigins.length && reqOrigin && !scopes.includes('admin:all')) {
            if (!allowedOrigins.includes(reqOrigin))
              return reply.code(403).send(errorResponseForStatus(403, 'Origin not allowed'));
          }

          if (row.rateLimitPerMin && isKeyRateLimited(row.keyId, row.rateLimitPerMin)) {
            return reply.code(429).send(errorResponseForStatus(429, 'Rate limit exceeded'));
          }

          req.apiKey = {
            id: row.id,
            ownerId: row.ownerId,
            scopes,
            keyId: row.keyId,
            prefix: row.prefix,
            isDemo: isDemoKey(row),
            rateLimitPerMin: row.rateLimitPerMin,
            allowedOrigins,
          };

          // Populate auth cache after successful verification
          authCacheSet(tokenHash, req.apiKey);

          if (shouldUpdateLastUsedAt(row.id)) {
            void db
              .update(apiKeysTable)
              .set({ lastUsedAt: new Date() })
              .where(eq(apiKeysTable.id, row.id))
              .catch((err) => {
                app.log.error({ err, apiKeyId: row.id }, 'lastUsedAt update failed');
              });
          }
        };
      }
    );

    app.decorate('requireInternalSignature', () => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        if (!verifyInternalSignature(req)) {
          return reply.code(401).send(errorResponseForStatus(401, 'Invalid internal signature'));
        }
      };
    });
  },
  { name: 'api-key-auth' }
);
