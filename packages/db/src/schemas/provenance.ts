import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { importsTable } from './imports.js';
import { resourceTypeEnum } from '../enums.js';
import { sql } from 'drizzle-orm';

export const provenanceTable = pgTable(
  'provenance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id')
      .notNull()
      .references(() => importsTable.id, { onDelete: 'cascade' }),
    resourceType: resourceTypeEnum('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(), // points to domain table row id
    sourceRef: text('source_ref'), // e.g., URL+fragment, SID, annex page, JSON pointer
    sourceHash: varchar('source_hash', { length: 64 }), // sha256 of source snippet/line
    rowHash: varchar('row_hash', { length: 64 }), // sha256 of normalized domain row
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
  },
  (t) => ({
    byResource: index('prov_resource_idx').on(t.resourceType, t.resourceId),
    byImport: index('prov_import_idx').on(t.importId),
    uniquePerRun: uniqueIndex('prov_unique_per_run')
      .on(t.importId, t.resourceType, t.resourceId, t.rowHash)
      .where(sql`row_hash IS NOT NULL`),
  })
);
