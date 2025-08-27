import { z } from 'zod/v4';
import {
  ManifestItemByIdSchema,
  ManifestItemInsertSchema,
  ManifestItemSelectCoercedSchema,
  ManifestItemSelectSchema,
  ManifestItemsListQuerySchema,
  ManifestItemUpdateSchema,
} from '../schemas/manifest-items.js';

export type ManifestItem = z.infer<typeof ManifestItemSelectSchema>;
export type ManifestItemCoerced = z.infer<typeof ManifestItemSelectCoercedSchema>;
export type ManifestItemInsert = z.infer<typeof ManifestItemInsertSchema>;
export type ManifestItemUpdate = z.infer<typeof ManifestItemUpdateSchema>;
export type ManifestItemById = z.infer<typeof ManifestItemByIdSchema>;
export type ManifestItemsListQuery = z.infer<typeof ManifestItemsListQuerySchema>;
