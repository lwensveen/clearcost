import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import {
  ManifestByIdSchema,
  ManifestInsertSchema,
  ManifestSelectCoercedSchema,
  ManifestsListQuerySchema,
  ManifestUpdateSchema,
} from '@clearcost/types/dist/schemas/manifests.js';
import {
  ManifestItemByIdSchema,
  ManifestItemInsertSchema,
  ManifestItemSelectCoercedSchema,
  ManifestItemsListQuerySchema,
  ManifestItemUpdateSchema,
} from '@clearcost/types/dist/schemas/manifest-items.js';

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
  const ListReplySchema = z.object({ items: z.array(ManifestSelectCoercedSchema) });

  r.get<{
    Querystring: z.infer<typeof ManifestsListQuerySchema>;
    Reply: z.infer<typeof ListReplySchema>;
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        querystring: ManifestsListQuerySchema,
        response: { 200: ListReplySchema },
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

      return { items: rows.map((r) => ManifestSelectCoercedSchema.parse(r)) };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // CREATE MANIFEST  POST /v1/manifests
  // ────────────────────────────────────────────────────────────────────────────
  const CreateBodySchema = ManifestInsertSchema.omit({
    id: true,
    ownerId: true,
    createdAt: true,
    updatedAt: true,
  });
  const CreateReplySchema = z.object({ id: z.string().uuid() });

  r.post<{
    Body: z.infer<typeof CreateBodySchema>;
    Reply: z.infer<typeof CreateReplySchema> | { error: string };
  }>(
    '/',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        body: CreateBodySchema,
        response: { 200: CreateReplySchema },
      },
    },
    async (req) => {
      const ownerId = req.apiKey!.ownerId;

      const g = await req.server.entitlements.guardCreateManifest(req);
      if (!g.allowed) {
        // If called from Fastify context, reply has already been sent in guard.
        return { error: g.reason } as const;
      }

      const rows = await db
        .insert(manifestsTable)
        .values({ ...req.body, ownerId })
        .returning({ id: manifestsTable.id });

      const row = rows[0];
      if (!row) {
        throw new Error('Manifest insert failed');
      }

      return { id: row.id };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // READ MANIFEST  GET /v1/manifests/:id
  // ────────────────────────────────────────────────────────────────────────────
  r.get<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Reply: z.infer<typeof ManifestSelectCoercedSchema> | { error: string };
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: ManifestSelectCoercedSchema,
          404: z.object({ error: z.string() }),
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

      if (!rows[0]) return reply.notFound('Not found');
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
  const OkReplySchema = z.object({ ok: z.literal(true) });
  const NotFoundReplySchema = z.object({ error: z.string() });

  r.patch<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Body: z.infer<typeof UpdateBodySchema>;
    Reply: z.infer<typeof OkReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        body: UpdateBodySchema,
        response: { 200: OkReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

      await db.update(manifestsTable).set(req.body).where(eq(manifestsTable.id, id));
      return { ok: true as const };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE MANIFEST  DELETE /v1/manifests/:id
  // ────────────────────────────────────────────────────────────────────────────
  r.delete<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Reply: z.infer<typeof OkReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        response: { 200: OkReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

      await db.delete(manifestsTable).where(eq(manifestsTable.id, id));
      return { ok: true as const };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // LIST ITEMS  GET /v1/manifests/:id/items?hs6=&categoryKey=&limit=
  // ────────────────────────────────────────────────────────────────────────────
  const ItemsListQuerySchema = ManifestItemsListQuerySchema.omit({ manifestId: true });
  const ItemsListReplySchema = z.object({ items: z.array(ManifestItemSelectCoercedSchema) });

  r.get<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Querystring: z.infer<typeof ItemsListQuerySchema>;
    Reply: z.infer<typeof ItemsListReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id/items',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        querystring: ItemsListQuerySchema,
        response: { 200: ItemsListReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

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
      if (!g.allowed) return reply.code(g.code).send({ error: g.reason });

      return { items: rows.map((r) => ManifestItemSelectCoercedSchema.parse(r)) };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ADD ITEMS (bulk)  POST /v1/manifests/:id/items
  // ────────────────────────────────────────────────────────────────────────────
  const AddItemsBodySchema = z.object({
    items: z
      .array(
        ManifestItemInsertSchema.omit({
          id: true,
          manifestId: true,
          createdAt: true,
          updatedAt: true,
        })
      )
      .min(1),
  });
  const AddItemsReplySchema = z.object({ inserted: z.number().int().min(0) });

  r.post<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Body: z.infer<typeof AddItemsBodySchema>;
    Reply: z.infer<typeof AddItemsReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id/items',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        body: AddItemsBodySchema,
        response: { 200: AddItemsReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

      const rows = req.body.items.map((it) => ({ ...it, manifestId: id }));
      const n = await db
        .insert(manifestItemsTable)
        .values(rows)
        .then((c) => c as unknown as number);

      return { inserted: n ?? rows.length };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // UPDATE ITEM  PATCH /v1/manifests/:id/items/:itemId
  // ────────────────────────────────────────────────────────────────────────────
  const ItemParamsSchema = z.object({
    id: ManifestByIdSchema.shape.id,
    itemId: ManifestItemByIdSchema.shape.id,
  });
  const ItemUpdateBodySchema = ManifestItemUpdateSchema.omit({
    id: true,
    manifestId: true,
    createdAt: true,
    updatedAt: true,
  });

  r.patch<{
    Params: z.infer<typeof ItemParamsSchema>;
    Body: z.infer<typeof ItemUpdateBodySchema>;
    Reply: z.infer<typeof OkReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id/items/:itemId',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ItemParamsSchema,
        body: ItemUpdateBodySchema,
        response: { 200: OkReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id, itemId } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

      const n = await db
        .update(manifestItemsTable)
        .set(req.body)
        .where(and(eq(manifestItemsTable.id, itemId), eq(manifestItemsTable.manifestId, id)))
        .then((c) => c as unknown as number);

      if (!n) return reply.notFound('Item not found');
      return { ok: true as const };
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE ITEM  DELETE /v1/manifests/:id/items/:itemId
  // ────────────────────────────────────────────────────────────────────────────
  r.delete<{
    Params: z.infer<typeof ItemParamsSchema>;
    Reply: z.infer<typeof OkReplySchema> | z.infer<typeof NotFoundReplySchema>;
  }>(
    '/:id/items/:itemId',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ItemParamsSchema,
        response: { 200: OkReplySchema, 404: NotFoundReplySchema },
      },
    },
    async (req, reply) => {
      const { id, itemId } = req.params;
      const ownerId = req.apiKey!.ownerId;

      const ok = await assertOwnsManifest(id, ownerId);
      if (!ok) return reply.notFound('Not found');

      const n = await db
        .delete(manifestItemsTable)
        .where(and(eq(manifestItemsTable.id, itemId), eq(manifestItemsTable.manifestId, id)))
        .then((c) => c as unknown as number);

      if (!n) return reply.notFound('Item not found');
      return { ok: true as const };
    }
  );
}
