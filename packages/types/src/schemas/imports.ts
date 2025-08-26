import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { importsTable } from '@clearcost/db';

export const ImportRunSelectSchema = createSelectSchema(importsTable);
export const ImportRunInsertSchema = createInsertSchema(importsTable);
export type ImportRun = z.infer<typeof ImportRunSelectSchema>;
export type ImportRunInsert = z.infer<typeof ImportRunInsertSchema>;
