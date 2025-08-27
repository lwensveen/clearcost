import { z } from 'zod/v4';
import {
  QuoteSnapshotByIdSchema,
  QuoteSnapshotByKeySchema,
  QuoteSnapshotInsertSchema,
  QuoteSnapshotSelectCoercedSchema,
  QuoteSnapshotSelectSchema,
  QuoteSnapshotsListQuerySchema,
  QuoteSnapshotUpdateSchema,
} from '../schemas/quote-snapshots.js';

export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSelectSchema>;
export type QuoteSnapshotCoerced = z.infer<typeof QuoteSnapshotSelectCoercedSchema>;
export type QuoteSnapshotInsert = z.infer<typeof QuoteSnapshotInsertSchema>;
export type QuoteSnapshotUpdate = z.infer<typeof QuoteSnapshotUpdateSchema>;
export type QuoteSnapshotById = z.infer<typeof QuoteSnapshotByIdSchema>;
export type QuoteSnapshotByKey = z.infer<typeof QuoteSnapshotByKeySchema>;
export type QuoteSnapshotsListQuery = z.infer<typeof QuoteSnapshotsListQuerySchema>;
