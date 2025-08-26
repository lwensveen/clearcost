import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { provenanceTable } from '@clearcost/db';

export const ProvenanceSelectSchema = createSelectSchema(provenanceTable);
export const ProvenanceInsertSchema = createInsertSchema(provenanceTable);
export type Provenance = z.infer<typeof ProvenanceSelectSchema>;
export type ProvenanceInsert = z.infer<typeof ProvenanceInsertSchema>;
