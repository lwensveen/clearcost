import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiKeysTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';
import { generateApiKey } from '../../../plugins/api-key-auth.js';

type Prefix = 'live' | 'test';
const isPrefix = (v: unknown): v is Prefix => v === 'live' || v === 'test';
const coercePrefix = (v: unknown): Prefix => (isPrefix(v) ? v : 'live');

export default function apiKeySelfRoutes(app: FastifyInstance) {
  // GET /v1/api-keys/self — introspect current key
  app.get(
    '/self',
    {
      preHandler: app.requireApiKey([], { optional: false }),
      schema: {
        response: {
          200: z.object({
            id: z.uuid(),
            keyId: z.string(),
            prefix: z.string(),
            ownerId: z.uuid(),
            name: z.string(),
            scopes: z.array(z.string()),
            isActive: z.boolean(),
            expiresAt: z.any().nullable(),
            revokedAt: z.any().nullable(),
            createdAt: z.any().nullable(),
            lastUsedAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.apiKey!;
      const rows = await db
        .select({
          id: apiKeysTable.id,
          keyId: apiKeysTable.keyId,
          prefix: apiKeysTable.prefix,
          ownerId: apiKeysTable.ownerId,
          name: apiKeysTable.name,
          scopes: apiKeysTable.scopes,
          isActive: apiKeysTable.isActive,
          expiresAt: apiKeysTable.expiresAt,
          revokedAt: apiKeysTable.revokedAt,
          createdAt: apiKeysTable.createdAt,
          lastUsedAt: apiKeysTable.lastUsedAt,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return reply.unauthorized(); // should not happen if middleware passed
      return row;
    }
  );

  // POST /v1/api-keys/self/rotate — issue a new key for the same owner
  app.post(
    '/self/rotate',
    {
      preHandler: app.requireApiKey([], { optional: false }),
      schema: {
        response: {
          201: z.object({
            id: z.uuid(),
            token: z.string(),
            keyId: z.string(),
            prefix: z.string(),
            name: z.string(),
            ownerId: z.uuid(),
            scopes: z.array(z.string()),
            isActive: z.boolean(),
            createdAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const curr = req.apiKey!;
      const ownerId = curr.ownerId;

      // Get current row’s name/scopes/prefix (fallback to request key if not found)
      const currentRows = await db
        .select({
          name: apiKeysTable.name,
          scopes: apiKeysTable.scopes,
          prefix: apiKeysTable.prefix,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, curr.id))
        .limit(1);

      const currentRow = currentRows[0];
      const baseName = currentRow?.name ?? 'key';
      const baseScopes = currentRow?.scopes ?? curr.scopes ?? [];
      const basePrefix: Prefix = coercePrefix(currentRow?.prefix);

      const { token, keyId, tokenPhc, prefix } = await generateApiKey(basePrefix);

      const rotatedName = `${baseName} (rotated ${new Date().toISOString().slice(0, 10)})`;

      const inserted = await db
        .insert(apiKeysTable)
        .values({
          keyId,
          prefix,
          name: rotatedName,
          ownerId,
          tokenPhc,
          scopes: baseScopes,
          isActive: true,
        })
        .returning({
          id: apiKeysTable.id,
          createdAt: apiKeysTable.createdAt,
        });

      const row = inserted[0];
      if (!row) return reply.internalServerError('Failed to create API key');

      return reply.code(201).send({
        id: row.id,
        token,
        keyId,
        prefix,
        name: rotatedName,
        ownerId,
        scopes: baseScopes,
        isActive: true,
        createdAt: row.createdAt,
      });
    }
  );

  // POST /v1/api-keys/self/revoke — revoke THIS key
  app.post(
    '/self/revoke',
    {
      preHandler: app.requireApiKey([], { optional: false }),
      schema: {
        response: {
          200: z.object({
            id: z.uuid(),
            isActive: z.boolean(),
            revokedAt: z.any().nullable(),
            updatedAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.apiKey!;
      const updated = await db
        .update(apiKeysTable)
        .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeysTable.id, id))
        .returning({
          id: apiKeysTable.id,
          isActive: apiKeysTable.isActive,
          revokedAt: apiKeysTable.revokedAt,
          updatedAt: apiKeysTable.updatedAt,
        });

      const row = updated[0];
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );
}
