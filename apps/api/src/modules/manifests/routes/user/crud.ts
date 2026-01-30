import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import { errorResponseForStatus } from '../../../../lib/errors.js';
import {
  ManifestByIdSchema,
  ManifestCreateBodySchema,
  ManifestCreateResponseSchema,
  ManifestErrorResponseSchema,
  ManifestItemByIdSchema,
  ManifestItemParamsSchema,
  ManifestItemSelectCoercedSchema,
  ManifestItemUpdateSchema,
  ManifestItemsAddBodySchema,
  ManifestItemsAddResponseSchema,
  ManifestItemsListResponseSchema,
  ManifestItemsListQuerySchema,
  ManifestOkResponseSchema,
  ManifestSelectCoercedSchema,
  ManifestUpdateSchema,
  ManifestsListResponseSchema,
  ManifestsListQuerySchema,
} from '@clearcost/types';

/**
 * NOTE:
 * - Owner scoping is enforced with `req.apiKey.ownerId`.
 * - Uses drizzle-zod schemas for body/response types.
 * - Hard-deletes by default (no deletedAt in provided manifest schema).
 */

export default async function manifestsCrud(app: FastifyInstance) {
  // Use Zod type provider so route generics drive req/rep typing
  const r = app.withTypeProvider<ZodTypeProvider>();

  async function assertOwnsManifest(manifestId: string, ownerId?: string) {
    if (!ownerId) return false;
    const row = await db
      .select({ id: manifestsTable.id })
      .from(manifestsTable)
      .where(and(eq(manifestsTable.id, manifestId), eq(manifestsTable.ownerId, ownerId)))
      .limit(1);
    return !!row[0];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LIST MANIFESTS  GET /v1/manifests?origin=&dest=&mode=&pricingMode=&limit=
  // ────────────────────────────────────────────────────────────────────────────
  r.get<{
    Querystring: z.infer<typeof ManifestsListQuerySchema>;
    Reply: z.infer<typeof ManifestsListResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        querystring: ManifestsListQuerySchema,
        response: { 200: ManifestsListResponseSchema },
      },
    },
    async (req) => {
      const ownerId = req.apiKey!.ownerId;
      const q = req.query;

      const where = and(
        eq(manifestsTable.ownerId, ownerId),
        ...(q.origin ? [eq(manifestsTable.origin, q.origin)] : []),
        ...(q.dest ? [eq(manifestsTable.dest, q.dest)] : []),
        ...(q.shippingMode ? [eq(manifestsTable.shippingMode, q.shippingMode)] : []),
        ...(q.pricingMode ? [eq(manifestsTable.pricingMode, q.pricingMode)] : [])
      );

      const rows = await db
        .select()
        .from(manifestsTable)
        .where(where)
        .orderBy(desc(manifestsTable.createdAt))
        .limit(q.limit ?? 100);

      return ManifestsListResponseSchema.parse({
        items: rows.map((r) => ManifestSelectCoercedSchema.parse(r)),
      });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // CREATE MANIFEST  POST /v1/manifests
  // ────────────────────────────────────────────────────────────────────────────
  r.post<{
    Body: z.infer<typeof ManifestCreateBodySchema>;
    Reply:
      | z.infer<typeof ManifestCreateResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        body: ManifestCreateBodySchema,
        response: { 200: ManifestCreateResponseSchema },
      },
    },
    async (req, reply) => {
      const ownerId = req.apiKey!.ownerId;

      const g = await req.server.entitlements.guardCreateManifest(req);
      if (!g.allowed) {
        return reply.code(g.code).send(errorResponseForStatus(g.code, g.reason));
      }

      const rows = await db
        .insert(manifestsTable)
        .values({ ...req.body, ownerId })
        .returning({ id: manifestsTable.id });

      const row = rows[0];
      if (!row) {
        throw new Error('Manifest insert failed');
      }

      return ManifestCreateResponseSchema.parse({ id: row.id });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // READ MANIFEST  GET /v1/manifests/:id
  // ────────────────────────────────────────────────────────────────────────────
  r.get<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Reply:
      | z.infer<typeof ManifestSelectCoercedSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: ManifestSelectCoercedSchema,
          404: ManifestErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const rows = await db
        .select()
        .from(manifestsTable)
        .where(and(eq(manifestsTable.id, id), eq(manifestsTable.ownerId, ownerId)))
        .limit(1);

      if (!rows[0]) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      return ManifestSelectCoercedSchema.parse(rows[0]);
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // UPDATE MANIFEST  PATCH /v1/manifests/:id
  // ────────────────────────────────────────────────────────────────────────────
  const UpdateBodySchema = ManifestUpdateSchema.omit({
    id: true,
    ownerId: true,
    createdAt: true,
    updatedAt: true,
  });

  r.patch<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Body: z.infer<typeof UpdateBodySchema>;
    Reply: z.infer<typeof ManifestOkResponseSchema> | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        body: UpdateBodySchema,
        response: { 200: ManifestOkResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      await db.update(manifestsTable).set(req.body).where(eq(manifestsTable.id, id));
      return ManifestOkResponseSchema.parse({ ok: true as const });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE MANIFEST  DELETE /v1/manifests/:id
  // ────────────────────────────────────────────────────────────────────────────
  r.delete<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Reply: z.infer<typeof ManifestOkResponseSchema> | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        response: { 200: ManifestOkResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      await db.delete(manifestsTable).where(eq(manifestsTable.id, id));
      return ManifestOkResponseSchema.parse({ ok: true as const });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // LIST ITEMS  GET /v1/manifests/:id/items?hs6=&categoryKey=&limit=
  // ────────────────────────────────────────────────────────────────────────────
  const ItemsListQuerySchema = ManifestItemsListQuerySchema.omit({ manifestId: true });

  r.get<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Querystring: z.infer<typeof ItemsListQuerySchema>;
    Reply:
      | z.infer<typeof ManifestItemsListResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id/items',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        querystring: ItemsListQuerySchema,
        response: { 200: ManifestItemsListResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const q = req.query;

      const where = and(
        eq(manifestItemsTable.manifestId, id),
        ...(q.hs6 ? [eq(manifestItemsTable.hs6, q.hs6)] : []),
        ...(q.categoryKey ? [eq(manifestItemsTable.categoryKey, q.categoryKey)] : [])
      );

      const rows = await db
        .select()
        .from(manifestItemsTable)
        .where(where)
        .orderBy(desc(manifestItemsTable.createdAt))
        .limit(q.limit ?? 500);

      // (If you intend this guard for read limits, keep it; otherwise remove.)
      const g = await req.server.entitlements.guardAppendItems(req, id, rows.length);
      if (!g.allowed) return reply.code(g.code).send(errorResponseForStatus(g.code, g.reason));

      return ManifestItemsListResponseSchema.parse({
        items: rows.map((r) => ManifestItemSelectCoercedSchema.parse(r)),
      });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ADD ITEMS (bulk)  POST /v1/manifests/:id/items
  // ────────────────────────────────────────────────────────────────────────────
  r.post<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Body: z.infer<typeof ManifestItemsAddBodySchema>;
    Reply:
      | z.infer<typeof ManifestItemsAddResponseSchema>
      | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id/items',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        body: ManifestItemsAddBodySchema,
        response: { 200: ManifestItemsAddResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const rows = req.body.items.map((it) => ({ ...it, manifestId: id }));
      const n = await db
        .insert(manifestItemsTable)
        .values(rows)
        .then((c) => c as unknown as number);

      return ManifestItemsAddResponseSchema.parse({ inserted: n ?? rows.length });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // UPDATE ITEM  PATCH /v1/manifests/:id/items/:itemId
  // ────────────────────────────────────────────────────────────────────────────
  const ItemUpdateBodySchema = ManifestItemUpdateSchema.omit({
    id: true,
    manifestId: true,
    createdAt: true,
    updatedAt: true,
  });

  r.patch<{
    Params: z.infer<typeof ManifestItemParamsSchema>;
    Body: z.infer<typeof ItemUpdateBodySchema>;
    Reply: z.infer<typeof ManifestOkResponseSchema> | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id/items/:itemId',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestItemParamsSchema,
        body: ItemUpdateBodySchema,
        response: { 200: ManifestOkResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id, itemId } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const n = await db
        .update(manifestItemsTable)
        .set(req.body)
        .where(and(eq(manifestItemsTable.id, itemId), eq(manifestItemsTable.manifestId, id)))
        .then((c) => c as unknown as number);

      if (!n) return reply.code(404).send(errorResponseForStatus(404, 'Item not found'));
      return ManifestOkResponseSchema.parse({ ok: true as const });
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE ITEM  DELETE /v1/manifests/:id/items/:itemId
  // ────────────────────────────────────────────────────────────────────────────
  r.delete<{
    Params: z.infer<typeof ManifestItemParamsSchema>;
    Reply: z.infer<typeof ManifestOkResponseSchema> | z.infer<typeof ManifestErrorResponseSchema>;
  }>(
    '/:id/items/:itemId',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestItemParamsSchema,
        response: { 200: ManifestOkResponseSchema, 404: ManifestErrorResponseSchema },
      },
    },
    async (req, reply) => {
      const { id, itemId } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.code(404).send(errorResponseForStatus(404, 'Not found'));

      const n = await db
        .delete(manifestItemsTable)
        .where(and(eq(manifestItemsTable.id, itemId), eq(manifestItemsTable.manifestId, id)))
        .then((c) => c as unknown as number);

      if (!n) return reply.code(404).send(errorResponseForStatus(404, 'Item not found'));
      return ManifestOkResponseSchema.parse({ ok: true as const });
    }
  );
}
