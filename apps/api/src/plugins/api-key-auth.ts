import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { apiKeysTable, db } from '@clearcost/db';
import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import fp from 'fastify-plugin';

function hashToken(token: string, pepper?: string) {
  return createHash('sha256')
    .update(token + (pepper ?? ''))
    .digest('hex');
}

export function generateApiKey(): string {
  return 'ck_' + randomBytes(24).toString('base64url'); // ~32 chars
}

export const apiKeyAuthPlugin: FastifyPluginAsync = fp(
  async (app: FastifyInstance) => {
    const PEPPER = process.env.API_KEY_PEPPER ?? '';

    app.decorate('requireApiKey', (requiredScopes?: string[]) => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        const hdr =
          (req.headers['authorization'] as string | undefined) ??
          (req.headers['x-api-key'] as string | undefined);

        const token =
          typeof hdr === 'string' && hdr.startsWith('Bearer ')
            ? hdr.slice(7).trim()
            : typeof hdr === 'string'
              ? hdr.trim()
              : null;

        if (!token) {
          return reply.unauthorized('Missing API key');
        }

        const hash = hashToken(token, PEPPER);

        const rows = await db
          .select()
          .from(apiKeysTable)
          .where(and(eq(apiKeysTable.tokenHash, hash), eq(apiKeysTable.isActive, true)))
          .limit(1);

        const row = rows[0];
        if (!row) {
          return reply.unauthorized('Invalid API key');
        }

        if (requiredScopes?.length) {
          const ok = requiredScopes.every((s) => row.scopes.includes(s));
          if (!ok) return reply.forbidden('Missing required scope(s)');
        }

        req.apiKey = { id: row.id, ownerId: row.ownerId, scopes: row.scopes };

        db.update(apiKeysTable)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeysTable.id, row.id))
          .catch(() => {});
      };
    });
  },
  { name: 'api-key-auth' }
);
