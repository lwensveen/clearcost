import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { quoteSnapshotsTable } from '@clearcost/db';

/** Base schemas generated from Drizzle */
export const QuoteSnapshotSelectSchema = createSelectSchema(quoteSnapshotsTable);
export const QuoteSnapshotInsertSchema = createInsertSchema(quoteSnapshotsTable);
export const QuoteSnapshotUpdateSchema = createUpdateSchema(quoteSnapshotsTable);

/** “Coerced” view for safer parsing of dates & optional JSON-ish fields */
export const QuoteSnapshotSelectCoercedSchema = QuoteSnapshotSelectSchema.extend({
  // ensure uniform date parsing
  createdAt: z.coerce.date(),
  fxAsOf: z.coerce.date().nullable().optional(),
  request: z.unknown(),
  response: z.unknown(),
  dataRuns: z.unknown().nullable().optional(),
  scope: z.string(),
  idemKey: z.string(),
});

/** Lookups / filters */
export const QuoteSnapshotByIdSchema = z.object({ id: z.string().uuid() });

export const QuoteSnapshotByKeySchema = z.object({
  scope: z.string().min(1).default('quotes'),
  idemKey: z.string().min(1),
});

export const QuoteSnapshotsListQuerySchema = z.object({
  scope: z.string().min(1).default('quotes').optional(),
  idemKey: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});
