import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { desc, eq } from 'drizzle-orm';
import { db, manifestItemQuotesTable, manifestQuotesTable } from '@clearcost/db';
import { errorResponseForStatus } from '../../../../lib/errors.js';
import {
  ManifestByIdSchema,
  ManifestErrorResponseSchema,
  ManifestItemQuoteSelectCoercedSchema,
  ManifestQuoteResponseSchema,
  ManifestQuoteSelectCoercedSchema,
} from '@clearcost/types';
import { assertOwnsManifest } from './utils.js';

type ManifestItemQuoteCoerced = z.infer<typeof ManifestItemQuoteSelectCoercedSchema>;
type ManifestQuoteCoerced = z.infer<typeof ManifestQuoteSelectCoercedSchema>;

export default async function manifestsQuoteRoute(app: FastifyInstance) {
  app.get(
    '/:id/quote', // align param name with ManifestByIdSchema
    {
      preHandler: app.requireApiKey(['manifests:read']),
      schema: {
        params: ManifestByIdSchema,
        response: {
          200: ManifestQuoteResponseSchema,
          404: ManifestErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = ManifestByIdSchema.parse(req.params);
      const ownerId = req.apiKey!.ownerId;

      if (!(await assertOwnsManifest(id, ownerId))) {
        return reply.code(404).send(errorResponseForStatus(404, 'Not found'));
      }

      // Latest summary row
      const summaries = await db
        .select()
        .from(manifestQuotesTable)
        .where(eq(manifestQuotesTable.manifestId, id))
        .orderBy(desc(manifestQuotesTable.updatedAt))
        .limit(1);

      const summaryRow = summaries[0];
      if (!summaryRow)
        return reply.code(404).send(errorResponseForStatus(404, 'No quote available'));

      const s = ManifestQuoteSelectCoercedSchema.parse(summaryRow);

      // Item-level quotes for the manifest
      const itemRows = await db
        .select()
        .from(manifestItemQuotesTable)
        .where(eq(manifestItemQuotesTable.manifestId, id))
        .orderBy(desc(manifestItemQuotesTable.updatedAt))
        .limit(1000);

      const items = itemRows.map((r) => {
        const it: ManifestItemQuoteCoerced = ManifestItemQuoteSelectCoercedSchema.parse(r);
        return {
          id: it.id,
          currency: it.currency,
          basis: it.basis,
          chargeableKg: it.chargeableKg ?? null,
          freightShare: it.freightShare,
          components: it.components,
        };
      });

      const summary = {
        itemsCount: s.itemsCount,
        currency: (s as ManifestQuoteCoerced).currency,
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
