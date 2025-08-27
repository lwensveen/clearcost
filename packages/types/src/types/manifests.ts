import { z } from 'zod/v4';
import {
  ManifestByIdSchema,
  ManifestInsertSchema,
  ManifestSelectCoercedSchema,
  ManifestSelectSchema,
  ManifestsListQuerySchema,
  ManifestUpdateSchema,
} from '../schemas/manifests.js';

export type Manifest = z.infer<typeof ManifestSelectSchema>;
export type ManifestCoerced = z.infer<typeof ManifestSelectCoercedSchema>;
export type ManifestInsert = z.infer<typeof ManifestInsertSchema>;
export type ManifestUpdate = z.infer<typeof ManifestUpdateSchema>;
export type ManifestById = z.infer<typeof ManifestByIdSchema>;
export type ManifestsListQuery = z.infer<typeof ManifestsListQuerySchema>;
