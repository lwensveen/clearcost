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
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Token format:  ck_<prefix>_<keyId>.<secret>
const TOKEN_RE = /^ck_([a-z0-9-]+)_([A-Za-z0-9_-]{6,32})\.([A-Za-z0-9_-]{16,})$/i;

function sha256Hex(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

function digest(secret: string, salt: string, pepper: string) {
  const joined = Buffer.from(`${salt}|${secret}|${pepper}`, 'utf8');
  return createHash('sha256').update(joined).digest();
}

export function generateApiKey(prefix: 'live' | 'test' = 'live') {
  const keyId = randomBytes(8).toString('base64url'); // public id
  const secret = randomBytes(24).toString('base64url'); // secret chunk
  const token = `ck_${prefix}_${keyId}.${secret}`;
  const salt = randomBytes(16).toString('base64url');
  return { token, keyId, secret, salt, prefix };
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
    apiKey?: { id: string; ownerId: string; scopes: string[]; keyId: string; prefix: string };
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
  }
}

type RequireApiKeyOptions = {
  ownerFrom?: (req: FastifyRequest) => string | undefined;
  optional?: boolean;
  internalSigned?: boolean;
};

export const apiKeyAuthPlugin: FastifyPluginAsync = fp(
  async (app: FastifyInstance) => {
    const PEPPER = process.env.API_KEY_PEPPER ?? '';
    const INTERNAL_SIGNING_SECRET = process.env.INTERNAL_SIGNING_SECRET ?? '';

    function verifyInternalSignature(req: FastifyRequest): boolean {
      if (!INTERNAL_SIGNING_SECRET) return true;
      const ts = req.headers['x-cc-ts'];
      const sig = req.headers['x-cc-sig'];
      if (typeof ts !== 'string' || typeof sig !== 'string') return false;

      const skewMs = Math.abs(Date.now() - Number(ts));
      if (!Number.isFinite(skewMs) || skewMs > 5 * 60 * 1000) return false;

      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      const payload = `${ts}:${req.method}:${req.url}:${sha256Hex(Buffer.from(bodyStr))}`;
      const expectedHex = createHash('sha256')
        .update(payload + '|' + INTERNAL_SIGNING_SECRET)
        .digest('hex');

      try {
        return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(sig, 'hex'));
      } catch {
        return false;
      }
    }

    app.decorate(
      'requireApiKey',
      // DEFINITIVE FIX: Default parameters to guarantee they are never undefined.
      (requiredScopes: string[] = [], opts: RequireApiKeyOptions = {}) => {
        return async (req: FastifyRequest, reply: FastifyReply) => {
          if (opts.internalSigned === true && !verifyInternalSignature(req)) {
            return reply.unauthorized('Invalid internal signature');
          }

          const authHdr = req.headers['authorization'] as string | undefined;
          const apiHdr = req.headers['x-api-key'] as string | undefined;
          const presented = parsePresentedToken(authHdr ?? apiHdr);

          if (!presented) {
            if (opts.optional) return;
            return reply.unauthorized('Missing or malformed API key');
          }

          const keyId: string = presented.keyId;
          const secret: string = presented.secret;
          const presentedPrefix: string = presented.prefix;

          const rows = await db
            .select()
            .from(apiKeysTable)
            .where(and(eq(apiKeysTable.keyId, keyId), eq(apiKeysTable.isActive, true)))
            .limit(1);

          const row = rows[0];
          if (!row) {
            return reply.unauthorized('Invalid API key');
          }

          if (row.prefix && row.prefix !== presentedPrefix) {
            return reply.unauthorized('Invalid API key');
          }

          if (row.expiresAt && row.expiresAt < new Date()) {
            return reply.unauthorized('API key expired');
          }
          if (row.revokedAt) {
            return reply.unauthorized('API key revoked');
          }

          try {
            const expectedDigest = digest(secret, row.salt, PEPPER);
            const stored = Buffer.from(row.tokenHash, 'hex');
            if (!timingSafeEqual(expectedDigest, stored)) {
              return reply.unauthorized('Invalid API key');
            }
          } catch {
            return reply.unauthorized('Invalid API key');
          }

          const scopes = row.scopes ?? [];
          const allowedOrigins = row.allowedOrigins ?? [];

          if (requiredScopes.length) {
            const ok = requiredScopes.every(
              (s) => scopes.includes(s) || scopes.includes('admin:all')
            );
            if (!ok) return reply.forbidden('Missing required scope(s)');
          }

          const ownerFrom = opts.ownerFrom?.(req);
          if (ownerFrom && row.ownerId !== ownerFrom && !scopes.includes('admin:all')) {
            return reply.forbidden('Owner mismatch');
          }

          const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
          if (allowedOrigins.length && reqOrigin && !scopes.includes('admin:all')) {
            if (!allowedOrigins.includes(reqOrigin)) {
              return reply.forbidden('Origin not allowed');
            }
          }

          req.apiKey = {
            id: row.id,
            ownerId: row.ownerId,
            scopes: scopes,
            keyId: row.keyId,
            prefix: row.prefix,
          };

          void db
            .update(apiKeysTable)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeysTable.id, row.id))
            .catch(() => {});
        };
      }
    );
  },
  { name: 'api-key-auth' }
);
