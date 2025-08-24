import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { categoriesTable } from '@clearcost/db';

export const CategorySelectSchema = createSelectSchema(categoriesTable);
export const CategoryInsertSchema = createInsertSchema(categoriesTable);
export const CategoryUpdateSchema = createUpdateSchema(categoriesTable);

export const CategorySelectCoercedSchema = CategorySelectSchema.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const CategoryByIdSchema = z.object({ id: z.string().uuid() });
export const CategoryByKeySchema = z.object({ key: z.string().min(1) });

export const CategoriesListQuerySchema = z.object({
  keyLike: z.string().min(1).optional(),
  defaultHs6: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
