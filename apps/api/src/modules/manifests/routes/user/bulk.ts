import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { count, desc, eq } from 'drizzle-orm';
import { db, manifestItemsTable } from '@clearcost/db';
import {
  IdempotencyHeaderSchema,
  ManifestByIdSchema,
  ManifestErrorResponseSchema,
  ManifestItemInsertSchema,
  ManifestItemsCsvResponseSchema,
  ManifestItemSelectCoercedSchema,
  ManifestItemsImportResponseSchema,
  ManifestItemsReplaceBodySchema,
  ManifestItemsReplaceResponseSchema,
} from '@clearcost/types';
import { assertOwnsManifest, ImportQuery, mapRecordToItem, parseCsv, RowShape } from './utils.js';
import { errorResponseForStatus } from '../../../../lib/errors.js';

/** Minimal CSV serializer */
function toCsvRow(fields: Array<string | number | null | undefined>) {
  return fields
    .map((v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

export default async function manifestsBulkRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ---------------------------------------------------------------------------
  // POST /v1/manifests/:id/items:replace  (replace entire list)
  // ---------------------------------------------------------------------------
  const ReplaceBodySchema = ManifestItemsReplaceBodySchema;
  const ReplaceReplySchema = ManifestItemsReplaceResponseSchema;
  const NotFoundReply = ManifestErrorResponseSchema;

  r.post<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Headers: z.infer<typeof IdempotencyHeaderSchema>;
    Body: z.infer<typeof ReplaceBodySchema>;
    Reply: z.infer<typeof ReplaceReplySchema> | z.infer<typeof NotFoundReply>;
  }>(
    '/:id/items:replace',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        headers: IdempotencyHeaderSchema,
        body: ReplaceBodySchema,
        response: { 200: ReplaceReplySchema, 404: NotFoundReply },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      if (!(await assertOwnsManifest(id, ownerId))) {
        return reply.code(404).send(errorResponseForStatus(404, 'Manifest not found'));
      }

      const { items, dryRun } = req.body;
      const rows = items.map((it) => ({ ...it, manifestId: id }));

      const g = await req.server.entitlements.guardReplaceItems(req, id, rows.length);
      if (!g.allowed) return reply.code(g.code).send(errorResponseForStatus(g.code, g.reason));

      if (dryRun) {
        const rows = await db
          .select({ total: count() })
          .from(manifestItemsTable)
          .where(eq(manifestItemsTable.manifestId, id));
        return { replaced: rows[0]?.total ?? 0 };
      }

      await db.transaction(async (tx) => {
        await tx.delete(manifestItemsTable).where(eq(manifestItemsTable.manifestId, id));
        if (rows.length) {
          type ItemInsert = typeof manifestItemsTable.$inferInsert;
          await tx.insert(manifestItemsTable).values(rows as ItemInsert[]);
        }
      });

      return { replaced: rows.length };
    }
  );

  // ---------------------------------------------------------------------------
  // GET /v1/manifests/:id/items.csv  (export)
  // ---------------------------------------------------------------------------
  r.get<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Reply: string | z.infer<typeof NotFoundReply>;
  }>(
    '/:id/items.csv',
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: { 200: ManifestItemsCsvResponseSchema, 404: NotFoundReply },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;

      if (!(await assertOwnsManifest(id, ownerId))) {
        return reply.code(404).send(errorResponseForStatus(404, 'Manifest not found'));
      }

      const rows = await db
        .select()
        .from(manifestItemsTable)
        .where(eq(manifestItemsTable.manifestId, id))
        .orderBy(desc(manifestItemsTable.createdAt))
        .limit(5000);

      const items = rows.map((r) => ManifestItemSelectCoercedSchema.parse(r));

      const header = [
        'id',
        'manifestId',
        'reference',
        'notes',
        'hs6',
        'categoryKey',
        'itemValueAmount',
        'itemValueCurrency',
        'weightKg',
        'quantity',
        'liters',
        'dimsL',
        'dimsW',
        'dimsH',
        'createdAt',
        'updatedAt',
      ];

      const lines = [header.join(',')];
      for (const it of items) {
        lines.push(
          toCsvRow([
            it.id,
            // use the route param for manifestId
            id,
            it.reference ?? '',
            it.notes ?? '',
            it.hs6 ?? '',
            it.categoryKey ?? '',
            it.itemValueAmount,
            it.itemValueCurrency,
            it.weightKg,
            it.quantity ?? '',
            it.liters ?? '',
            it.dimsCm?.l ?? 0,
            it.dimsCm?.w ?? 0,
            it.dimsCm?.h ?? 0,
            it.createdAt.toISOString(),
            it.updatedAt.toISOString(),
          ])
        );
      }

      const body = lines.join('\r\n');
      reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="manifest-${id}-items.csv"`)
        .send(body);
    }
  );

  // ---------------------------------------------------------------------------
  // POST /v1/manifests/:id/items:import-csv  (append|replace)
  // Content-Type: text/csv; query: ?mode=append|replace&dryRun=true|false
  // ---------------------------------------------------------------------------
  const ImportReplySchema = ManifestItemsImportResponseSchema;

  r.post<{
    Params: z.infer<typeof ManifestByIdSchema>;
    Querystring: z.infer<typeof ImportQuery>;
    Body: unknown; // raw text/csv; we'll parse manually
    Reply: z.infer<typeof ImportReplySchema> | z.infer<typeof NotFoundReply>;
  }>(
    '/:id/items:import-csv',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: ManifestByIdSchema,
        querystring: ImportQuery,
        response: { 200: ImportReplySchema, 404: NotFoundReply },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const ownerId = req.apiKey!.ownerId;
      const q = req.query;

      if (!(await assertOwnsManifest(id, ownerId))) {
        return reply.code(404).send(errorResponseForStatus(404, 'Manifest not found'));
      }

      const bodyStr =
        typeof req.body === 'string'
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body.toString('utf8')
            : '';

      const recs = parseCsv(bodyStr);
      const rows: RowShape[] = [];
      const errors: Array<{ line: number; message: string }> = [];

      for (let i = 0; i < recs.length; i++) {
        try {
          const shaped = mapRecordToItem(recs[i]!, id);
          rows.push(ManifestItemInsertSchema.parse(shaped));
        } catch (e: unknown) {
          errors.push({ line: i + 2, message: e instanceof Error ? e.message : 'Invalid row' }); // +2: header + 1-based
        }
      }

      if (!q.dryRun) {
        if (q.mode === 'replace') {
          const g = await req.server.entitlements.guardReplaceItems(req, id, rows.length);
          if (!g.allowed) return reply.code(g.code).send(errorResponseForStatus(g.code, g.reason));
        } else {
          const g = await req.server.entitlements.guardAppendItems(req, id, rows.length);
          if (!g.allowed) return reply.code(g.code).send(errorResponseForStatus(g.code, g.reason));
        }
      }

      if (q.dryRun) {
        let replaced: number | undefined = undefined;
        if (q.mode === 'replace') {
          const countRows = await db
            .select({ total: count() })
            .from(manifestItemsTable)
            .where(eq(manifestItemsTable.manifestId, id));
          replaced = countRows[0]?.total ?? 0;
        }
        return {
          mode: q.mode,
          dryRun: true,
          valid: rows.length,
          invalid: errors.length,
          inserted: 0,
          replaced,
          errors,
        };
      }

      let inserted = 0;
      let replaced: number | undefined = undefined;

      await db.transaction(async (tx) => {
        if (q.mode === 'replace') {
          const countRows = await tx
            .select({ total: count() })
            .from(manifestItemsTable)
            .where(eq(manifestItemsTable.manifestId, id));
          replaced = countRows[0]?.total ?? 0;

          await tx.delete(manifestItemsTable).where(eq(manifestItemsTable.manifestId, id));
        }
        if (rows.length) {
          type ItemInsert = typeof manifestItemsTable.$inferInsert;
          await tx.insert(manifestItemsTable).values(rows as ItemInsert[]);
          inserted = rows.length;
        }
      });

      return {
        mode: q.mode,
        dryRun: false,
        valid: rows.length,
        invalid: errors.length,
        inserted,
        replaced,
        errors,
      };
    }
  );
}
