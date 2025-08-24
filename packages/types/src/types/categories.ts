import { z } from 'zod/v4';
import {
  CategoriesListQuerySchema,
  CategoryByIdSchema,
  CategoryByKeySchema,
  CategoryInsertSchema,
  CategorySelectCoercedSchema,
  CategorySelectSchema,
  CategoryUpdateSchema,
} from '../schemas/index.js';

export type Category = z.infer<typeof CategorySelectSchema>;
export type CategoryCoerced = z.infer<typeof CategorySelectCoercedSchema>;
export type CategoryInsert = z.infer<typeof CategoryInsertSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type CategoryById = z.infer<typeof CategoryByIdSchema>;
export type CategoryByKey = z.infer<typeof CategoryByKeySchema>;
export type CategoriesListQuery = z.infer<typeof CategoriesListQuerySchema>;
