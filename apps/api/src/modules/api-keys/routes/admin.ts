import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiKeysTable, db } from '@clearcost/db';
import { and, eq, sql } from 'drizzle-orm';
import { generateApiKey } from '../../../plugins/api-key-auth.js';
import { errorResponseForStatus } from '../../../lib/errors.js';
import {
  ApiKeyAdminCreateBodySchema,
  ApiKeyAdminGetResponseSchema,
  ApiKeyAdminListQuerySchema,
  ApiKeyAdminListResponseSchema,
  ApiKeyAdminPatchBodySchema,
  ApiKeyAdminRotateBodySchema,
  ApiKeyAdminRotateResponseSchema,
  ApiKeyCreateResponseSchema,
  ApiKeyErrorResponseSchema,
  ApiKeyIdParamSchema,
  ApiKeyStatusResponseSchema,
} from '@clearcost/types';

type Prefix = 'live' | 'test';
const isPrefix = (v: unknown): v is Prefix => v === 'live' || v === 'test';
const coercePrefix = (v: unknown): Prefix => (isPrefix(v) ? v : 'live');

export default function apiKeyAdminRoutes(app: FastifyInstance) {
  // GET /v1/admin/api-keys?ownerId=...&activeOnly=true
  app.get<{ Querystring: z.infer<typeof ApiKeyAdminListQuerySchema> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        querystring: ApiKeyAdminListQuerySchema,
        response: {
          200: ApiKeyAdminListResponseSchema,
        },
      },
    },
    async (req) => {
      const { ownerId, activeOnly } = ApiKeyAdminListQuerySchema.parse(req.query);

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
        .where(
          and(
            eq(apiKeysTable.ownerId, ownerId),
            activeOnly ? eq(apiKeysTable.isActive, true) : sql`TRUE`
          )
        );
      return ApiKeyAdminListResponseSchema.parse(rows);
    }
  );

  // POST /v1/admin/api-keys  — returns the plaintext token ONCE
  app.post<{
    Body: z.infer<typeof ApiKeyAdminCreateBodySchema>;
    Reply: z.infer<typeof ApiKeyCreateResponseSchema> | z.infer<typeof ApiKeyErrorResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        body: ApiKeyAdminCreateBodySchema,
        response: {
          201: ApiKeyCreateResponseSchema,
          500: ApiKeyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const body = ApiKeyAdminCreateBodySchema.parse(req.body);

      const { token, keyId, tokenPhc, prefix } = await generateApiKey(body.prefix);

      const inserted = await db
        .insert(apiKeysTable)
        .values({
          keyId,
          prefix,
          name: body.name,
          ownerId: body.ownerId,
          tokenPhc,
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
      if (!row)
        return reply.code(500).send(errorResponseForStatus(500, 'Failed to create API key'));

      return reply.code(201).send(
        ApiKeyCreateResponseSchema.parse({
          id: row.id,
          token,
          keyId,
          prefix,
          name: body.name,
          ownerId: body.ownerId,
          scopes: body.scopes,
          isActive: true,
          createdAt: row.createdAt,
        })
      );
    }
  );

  // GET /v1/admin/api-keys/:id
  app.get<{ Params: z.infer<typeof ApiKeyIdParamSchema> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: ApiKeyIdParamSchema,
        response: {
          200: ApiKeyAdminGetResponseSchema,
          404: ApiKeyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = ApiKeyIdParamSchema.parse(req.params);
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
      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return ApiKeyAdminGetResponseSchema.parse(row);
    }
  );

  // PATCH /v1/admin/api-keys/:id — update/revoke/reactivate
  app.patch<{
    Params: z.infer<typeof ApiKeyIdParamSchema>;
    Body: z.infer<typeof ApiKeyAdminPatchBodySchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: ApiKeyIdParamSchema,
        body: ApiKeyAdminPatchBodySchema,
        response: {
          200: ApiKeyStatusResponseSchema,
          404: ApiKeyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = ApiKeyIdParamSchema.parse(req.params);
      const patch = ApiKeyAdminPatchBodySchema.parse(req.body);

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
      if (!row) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return ApiKeyStatusResponseSchema.parse(row);
    }
  );

  // POST /v1/admin/api-keys/:id/rotate — admin-triggered rotation (returns plaintext token)
  app.post<{
    Params: z.infer<typeof ApiKeyIdParamSchema>;
    Body: z.infer<typeof ApiKeyAdminRotateBodySchema>;
    Reply:
      | z.infer<typeof ApiKeyAdminRotateResponseSchema>
      | z.infer<typeof ApiKeyErrorResponseSchema>;
  }>(
    '/:id/rotate',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: ApiKeyIdParamSchema,
        body: ApiKeyAdminRotateBodySchema.optional(),
        response: {
          201: ApiKeyAdminRotateResponseSchema,
          404: ApiKeyErrorResponseSchema,
          500: ApiKeyErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = ApiKeyIdParamSchema.parse(req.params);
      const body = ApiKeyAdminRotateBodySchema.parse(req.body ?? {});

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
      if (!cur) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const basePrefix: Prefix = coercePrefix(cur.prefix);
      const chosenPrefix: Prefix = body.prefix ?? basePrefix;

      const { token, keyId, tokenPhc } = await generateApiKey(chosenPrefix);

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
          tokenPhc,
          scopes,
          isActive: true,
          expiresAt,
          allowedCidrs,
          allowedOrigins,
          rateLimitPerMin,
        })
        .returning({ id: apiKeysTable.id, createdAt: apiKeysTable.createdAt });

      const row = inserted[0];
      if (!row)
        return reply
          .code(500)
          .send(errorResponseForStatus(500, 'Failed to create rotated API key'));

      return reply.code(201).send(
        ApiKeyAdminRotateResponseSchema.parse({
          id: row.id,
          token,
          keyId,
          prefix: chosenPrefix,
          name,
          ownerId: cur.ownerId,
          scopes,
          isActive: true,
          createdAt: row.createdAt,
        })
      );
    }
  );

  // GET /v1/admin/api-keys/:id/reveal — refuse (we don't store secrets)
  app.get<{ Params: z.infer<typeof ApiKeyIdParamSchema> }>(
    '/:id/reveal',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: ApiKeyIdParamSchema,
        response: {
          400: ApiKeyErrorResponseSchema,
        },
      },
    },
    async (_req, reply) => {
      return reply.code(400).send(
        errorResponseForStatus(
          400,
          'Secret material cannot be retrieved. Issue a new key via /:id/rotate.'
        )
      );
    }
  );
}
