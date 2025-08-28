import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiKeysTable, db } from '@clearcost/db';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { generateApiKey } from '../../../plugins/api-key-auth.js';

const CreateBody = z.object({
  ownerId: z.uuid(),
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  prefix: z.enum(['live', 'test']).default('live'),
  expiresAt: z.coerce.date().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().optional(),
});

const ListQuery = z.object({
  ownerId: z.uuid(),
  activeOnly: z.coerce.boolean().default(true),
});

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  scopes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().nullable().optional(),
  revoke: z.boolean().optional(), // sets revokedAt=now()
});

const RotateBody = z.object({
  name: z.string().min(1).optional(),
  prefix: z.enum(['live', 'test']).optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowedCidrs: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().positive().nullable().optional(),
});

const IdParam = z.object({ id: z.uuid() });

type Prefix = 'live' | 'test';
const isPrefix = (v: unknown): v is Prefix => v === 'live' || v === 'test';
const coercePrefix = (v: unknown): Prefix => (isPrefix(v) ? v : 'live');

export default function apiKeyAdminRoutes(app: FastifyInstance) {
  // GET /v1/admin/api-keys?ownerId=...&activeOnly=true
  app.get<{ Querystring: z.infer<typeof ListQuery> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        querystring: ListQuery,
        response: {
          200: z.array(
            z.object({
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
            })
          ),
        },
      },
    },
    async (req) => {
      const { ownerId, activeOnly } = ListQuery.parse(req.query);

      return db
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
        .where(
          and(
            eq(apiKeysTable.ownerId, ownerId),
            activeOnly ? eq(apiKeysTable.isActive, true) : sql`TRUE`
          )
        );
    }
  );

  // POST /v1/admin/api-keys  — returns the plaintext token ONCE
  app.post<{ Body: z.infer<typeof CreateBody> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        body: CreateBody,
        response: {
          201: z.object({
            id: z.uuid(),
            token: z.string(), // plaintext (only now)
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
      const body = CreateBody.parse(req.body);

      const { token, keyId, secret, salt, prefix } = generateApiKey(body.prefix);
      const pepper = process.env.API_KEY_PEPPER ?? '';
      const tokenHash = createHash('sha256').update(`${salt}|${secret}|${pepper}`).digest('hex');

      const inserted = await db
        .insert(apiKeysTable)
        .values({
          keyId,
          prefix,
          name: body.name,
          ownerId: body.ownerId,
          salt,
          tokenHash,
          scopes: body.scopes,
          isActive: true,
          expiresAt: body.expiresAt ?? null,
          allowedCidrs: body.allowedCidrs ?? [],
          allowedOrigins: body.allowedOrigins ?? [],
          rateLimitPerMin: body.rateLimitPerMin ?? null,
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
        name: body.name,
        ownerId: body.ownerId,
        scopes: body.scopes,
        isActive: true,
        createdAt: row.createdAt,
      });
    }
  );

  // GET /v1/admin/api-keys/:id
  app.get<{ Params: z.infer<typeof IdParam> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: IdParam,
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
      const { id } = IdParam.parse(req.params);
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
      if (!row) return reply.notFound('Not found');
      return row;
    }
  );

  // PATCH /v1/admin/api-keys/:id — update/revoke/reactivate
  app.patch<{ Params: z.infer<typeof IdParam>; Body: z.infer<typeof PatchBody> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: IdParam,
        body: PatchBody,
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
      const { id } = IdParam.parse(req.params);
      const patch = PatchBody.parse(req.body);

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.scopes !== undefined) updates.scopes = patch.scopes;
      if (patch.isActive !== undefined) updates.isActive = patch.isActive;
      if (patch.expiresAt !== undefined) updates.expiresAt = patch.expiresAt;
      if (patch.allowedCidrs !== undefined) updates.allowedCidrs = patch.allowedCidrs;
      if (patch.allowedOrigins !== undefined) updates.allowedOrigins = patch.allowedOrigins;
      if (patch.rateLimitPerMin !== undefined) updates.rateLimitPerMin = patch.rateLimitPerMin;
      if (patch.revoke) updates.revokedAt = new Date();

      const updated = await db
        .update(apiKeysTable)
        .set(updates)
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

  // POST /v1/admin/api-keys/:id/rotate — admin-triggered rotation (returns plaintext token)
  app.post<{ Params: z.infer<typeof IdParam>; Body: z.infer<typeof RotateBody> }>(
    '/:id/rotate',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: IdParam,
        body: RotateBody.optional(),
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
      const { id } = IdParam.parse(req.params);
      const body = RotateBody.parse(req.body ?? {});

      const currentRows = await db
        .select({
          ownerId: apiKeysTable.ownerId,
          name: apiKeysTable.name,
          scopes: apiKeysTable.scopes,
          prefix: apiKeysTable.prefix,
          expiresAt: apiKeysTable.expiresAt,
          allowedCidrs: apiKeysTable.allowedCidrs,
          allowedOrigins: apiKeysTable.allowedOrigins,
          rateLimitPerMin: apiKeysTable.rateLimitPerMin,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, id))
        .limit(1);

      const cur = currentRows[0];
      if (!cur) return reply.notFound('Not found');

      const basePrefix: Prefix = coercePrefix(cur.prefix);
      const chosenPrefix: Prefix = body.prefix ?? basePrefix;
      const { token, keyId, secret, salt } = generateApiKey(chosenPrefix);

      const pepper = process.env.API_KEY_PEPPER ?? '';
      const tokenHash = createHash('sha256').update(`${salt}|${secret}|${pepper}`).digest('hex');

      const name = body.name ?? `${cur.name} (rotated ${new Date().toISOString().slice(0, 10)})`;
      const scopes = body.scopes ?? cur.scopes ?? [];
      const expiresAt = body.expiresAt ?? cur.expiresAt ?? null;
      const allowedCidrs = body.allowedCidrs ?? cur.allowedCidrs ?? [];
      const allowedOrigins = body.allowedOrigins ?? cur.allowedOrigins ?? [];
      const rateLimitPerMin = body.rateLimitPerMin ?? cur.rateLimitPerMin ?? null;

      const inserted = await db
        .insert(apiKeysTable)
        .values({
          keyId,
          prefix: chosenPrefix,
          name,
          ownerId: cur.ownerId,
          salt,
          tokenHash,
          scopes,
          isActive: true,
          expiresAt,
          allowedCidrs,
          allowedOrigins,
          rateLimitPerMin,
        })
        .returning({ id: apiKeysTable.id, createdAt: apiKeysTable.createdAt });

      const row = inserted[0];
      if (!row) return reply.internalServerError('Failed to create rotated API key');

      return reply.code(201).send({
        id: row.id,
        token,
        keyId,
        prefix: chosenPrefix,
        name,
        ownerId: cur.ownerId,
        scopes,
        isActive: true,
        createdAt: row.createdAt,
      });
    }
  );

  // GET /v1/admin/api-keys/:id/reveal — refuse (we don't store secrets)
  app.get<{ Params: z.infer<typeof IdParam> }>(
    '/:id/reveal',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: IdParam,
        response: {
          400: z.object({ error: z.string() }),
        },
      },
    },
    async (_req, reply) => {
      return reply.code(400).send({
        error: 'Secret material cannot be retrieved. Issue a new key via /:id/rotate.',
      });
    }
  );
}
