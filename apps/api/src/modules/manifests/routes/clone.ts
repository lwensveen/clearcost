import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { and, eq } from 'drizzle-orm';
import { db, manifestItemsTable, manifestsTable } from '@clearcost/db';
import { ManifestInsertSchema } from '@clearcost/types/dist/schemas/manifests.js';

const Params = z.object({ manifestId: z.string().uuid() });

export default async function manifestsCloneRoute(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post<{
    Params: z.infer<typeof Params>;
    Body: { name?: string } | undefined;
    Reply: { id: string; itemsCopied: number } | { error: string };
  }>(
    '/:manifestId/clone',
    {
      preHandler: app.requireApiKey(['manifests:write']),
      schema: {
        params: Params,
        body: z.object({ name: z.string().min(1).max(200).optional() }).optional(),
        response: {
          200: z.object({ id: z.string().uuid(), itemsCopied: z.number().int().min(0) }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { manifestId } = req.params;
      const ownerId = req.apiKey!.ownerId;
      const overrideName = req.body?.name;

      // Fetch source manifest (must be owned by caller)
      const [src] = await db
        .select()
        .from(manifestsTable)
        .where(and(eq(manifestsTable.id, manifestId), eq(manifestsTable.ownerId, ownerId)))
        .limit(1);

      if (!src) return reply.notFound('Not found');

      // Restrict to insertable fields (omit id/owner/timestamps); this will carry over
      // origin, dest, shippingMode, pricingMode, fixedFreight*, reference, name, etc.
      const base = ManifestInsertSchema.omit({
        id: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      }).parse(src as any);

      type Insert = typeof manifestsTable.$inferInsert;

      // Compute a safe cloned name: prefer override, else "<source> (copy)", else "Copy of <id>"
      const srcName =
        typeof (src as any)?.name === 'string' && (src as any).name.trim()
          ? (src as any).name
          : undefined;
      const clonedName = overrideName ?? (srcName ? `${srcName} (copy)` : `Copy of ${manifestId}`);

      let newId = '';
      let itemsCopied = 0;

      await db.transaction(async (tx) => {
        // Insert cloned manifest
        const payload: Insert = {
          ...base,
          ownerId,
          name: clonedName,
        };

        const ret = await tx
          .insert(manifestsTable)
          .values(payload)
          .returning({ id: manifestsTable.id });

        const row = ret[0];
        if (!row) throw new Error('clone_insert_failed');
        newId = row.id;

        // Copy items to the new manifest
        const items = await tx
          .select()
          .from(manifestItemsTable)
          .where(eq(manifestItemsTable.manifestId, manifestId));

        if (items.length) {
          type ItemInsert = typeof manifestItemsTable.$inferInsert;
          const rows: ItemInsert[] = items.map((it: any) => {
            const { id, manifestId: _old, createdAt, updatedAt, ...rest } = it;
            return { ...rest, manifestId: newId };
          });
          await tx.insert(manifestItemsTable).values(rows);
          itemsCopied = rows.length;
        }
      });

      return { id: newId, itemsCopied };
    }
  );
}
