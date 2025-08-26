import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { apiKeysTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';

const CreateBody = z.object({
  ownerId: z.uuid(),
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
});
const ListQuery = z.object({
  ownerId: z.uuid(),
});
const PatchBody = z.object({
  isActive: z.boolean(),
});

function hashToken(token: string, pepper?: string) {
  return createHash('sha256')
    .update(token + (pepper ?? ''))
    .digest('hex');
}
function generateApiKey(): string {
  return 'ck_' + randomBytes(24).toString('base64url');
}

const IdParam = z.object({ id: z.string().uuid() });

export default function apiKeyRoutes(app: FastifyInstance) {
  // GET /v1/api-keys?ownerId=UUID  (admin)
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
              ownerId: z.uuid(),
              name: z.string(),
              scopes: z.array(z.string()),
              isActive: z.boolean(),
              createdAt: z.any().nullable(),
              lastUsedAt: z.any().nullable(),
            })
          ),
        },
      },
    },
    async (req) => {
      const { ownerId } = ListQuery.parse(req.query);

      return db
        .select({
          id: apiKeysTable.id,
          ownerId: apiKeysTable.ownerId,
          name: apiKeysTable.name,
          scopes: apiKeysTable.scopes,
          isActive: apiKeysTable.isActive,
          createdAt: apiKeysTable.createdAt,
          lastUsedAt: apiKeysTable.lastUsedAt,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.ownerId, ownerId));
    }
  );

  // POST /v1/api-keys  (admin) — returns plaintext token ONCE
  app.post<{ Body: z.infer<typeof CreateBody> }>(
    '/',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        body: CreateBody,
        response: {
          201: z.object({
            id: z.string().uuid(),
            token: z.string(), // plaintext (only now)
            name: z.string(),
            ownerId: z.string().uuid(),
            scopes: z.array(z.string()),
            isActive: z.boolean(),
            createdAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const body = CreateBody.parse(req.body);
      const token = generateApiKey();
      const tokenHash = hashToken(token, process.env.API_KEY_PEPPER ?? '');

      const rows = await db
        .insert(apiKeysTable)
        .values({
          name: body.name,
          ownerId: body.ownerId,
          tokenHash,
          scopes: body.scopes,
          isActive: true,
        })
        .returning({
          id: apiKeysTable.id,
          createdAt: apiKeysTable.createdAt,
        });

      const row = rows[0];

      if (!row) throw Error('Api key not found');

      return reply.code(201).send({
        id: row.id,
        token,
        name: body.name,
        ownerId: body.ownerId,
        scopes: body.scopes,
        isActive: true,
        createdAt: row.createdAt,
      });
    }
  );

  // PATCH /v1/api-keys/:id  (admin) — revoke/reactivate
  app.patch<{ Params: { id: string }; Body: z.infer<typeof PatchBody> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: z.object({ id: z.uuid() }),
        body: PatchBody,
        response: {
          200: z.object({
            id: z.uuid(),
            isActive: z.boolean(),
            updatedAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { isActive } = PatchBody.parse(req.body);

      const [row] = await db
        .update(apiKeysTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(apiKeysTable.id, id))
        .returning({
          id: apiKeysTable.id,
          isActive: apiKeysTable.isActive,
          updatedAt: apiKeysTable.updatedAt,
        });

      if (!row) return reply.notFound('Not found');
      return reply.send(row);
    }
  );

  app.get<{ Params: z.infer<typeof IdParam> }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['admin:api-keys']),
      schema: {
        params: IdParam,
        response: {
          200: z.object({
            id: z.string().uuid(),
            ownerId: z.string().uuid(),
            isActive: z.boolean(),
            createdAt: z.any().nullable(),
            lastUsedAt: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = IdParam.parse(req.params);

      const [row] = await db
        .select({
          id: apiKeysTable.id,
          ownerId: apiKeysTable.ownerId,
          isActive: apiKeysTable.isActive,
          createdAt: apiKeysTable.createdAt,
          lastUsedAt: apiKeysTable.lastUsedAt,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, id))
        .limit(1);

      if (!row) return reply.notFound('Not found');
      return row;
    }
  );
}
