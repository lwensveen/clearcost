import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { and, desc, eq } from 'drizzle-orm';
import { db, manifestItemQuotesTable, manifestQuotesTable, manifestsTable } from '@clearcost/db';
import { errorResponseForStatus } from '../../../../lib/errors.js';
import {
  ManifestByIdSchema,
  ManifestErrorResponseSchema,
  ManifestItemQuoteSelectCoercedSchema,
  ManifestQuoteResponseSchema,
  ManifestQuoteSelectCoercedSchema,
} from '@clearcost/types';

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
