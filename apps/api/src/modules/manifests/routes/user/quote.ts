import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemQuotesTable, manifestQuotesTable, manifestsTable } from '@clearcost/db';
import { ManifestByIdSchema } from '@clearcost/types/dist/schemas/manifests.js';
import { ManifestQuoteSelectCoercedSchema } from '@clearcost/types/dist/schemas/manifest-quotes.js';
import { ManifestItemQuoteSelectCoercedSchema } from '@clearcost/types/dist/schemas/manifest-item-quotes.js';

/** Ensure the manifest belongs to the caller */
async function assertOwnsManifest(manifestId: string, ownerId?: string) {
  if (!ownerId) return false;
  const row = await db
    .select({ id: manifestsTable.id })
    .from(manifestsTable)
    .where(and(eq(manifestsTable.id, manifestId), eq(manifestsTable.ownerId, ownerId)))
    .limit(1);
  return !!row[0];
}

export default async function manifestsQuoteRoute(app: FastifyInstance) {
  app.get(
    '/:id/quote', // align param name with ManifestByIdSchema
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: z.object({
            ok: z.literal(true),
            manifestId: z.string().uuid(),
            summary: z.object({
              itemsCount: z.number(),
              currency: z.string().length(3).optional(),
              freight: z.number(),
              duty: z.number(),
              vat: z.number(),
              fees: z.number(),
              checkoutVat: z.number().nullable().optional(),
              grandTotal: z.number(),
              fxAsOf: z.date().optional(),
              updatedAt: z.date(),
            }),
            items: z.array(
              z.object({
                id: z.string().uuid(),
                currency: z.string().length(3).optional(),
                basis: z.number(),
                chargeableKg: z.number().nullable().optional(),
                freightShare: z.number(),
                components: z.object({
                  CIF: z.number(),
                  duty: z.number(),
                  vat: z.number(),
                  fees: z.number(),
                  checkoutVAT: z.number().optional(),
                }),
              })
            ),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = ManifestByIdSchema.parse(req.params);
      const ownerId = req.apiKey!.ownerId;

      if (!(await assertOwnsManifest(id, ownerId))) {
        return reply.notFound('Not found');
      }

      // Latest summary row
      const summaries = await db
        .select()
        .from(manifestQuotesTable)
        .where(eq(manifestQuotesTable.manifestId, id))
        .orderBy(desc(manifestQuotesTable.updatedAt))
        .limit(1);

      const summaryRow = summaries[0];
      if (!summaryRow) return reply.notFound('No quote available');

      const s = ManifestQuoteSelectCoercedSchema.parse(summaryRow);

      // Item-level quotes for the manifest
      const itemRows = await db
        .select()
        .from(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, id))
        .orderBy(desc(manifestItemQuotesTable.updatedAt));

      const items = itemRows.map((r) => {
        const it = ManifestItemQuoteSelectCoercedSchema.parse(r);
        return {
          id: (it as any).id,
          currency: (it as any).currency,
          basis: it.basis,
          chargeableKg: it.chargeableKg ?? null,
          freightShare: it.freightShare,
          components: it.components,
        };
      });

      const summary = {
        itemsCount: s.itemsCount,
        currency: (s as any).currency,
        freight: s.freightTotal,
        duty: s.dutyTotal,
        vat: s.vatTotal,
        fees: s.feesTotal,
        checkoutVat: s.checkoutVatTotal ?? null,
        grandTotal: s.grandTotal,
        fxAsOf: s.fxAsOf,
        updatedAt: s.updatedAt,
      };

      return { ok: true as const, manifestId: id, summary, items };
    }
  );
}
