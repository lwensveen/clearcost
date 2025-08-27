import { relations } from 'drizzle-orm';
import { manifestQuotesTable } from '../manifest-quotes.js';
import { manifestsTable } from '../manifests.js';

export const manifestQuotesRelations = relations(manifestQuotesTable, ({ one }) => ({
  manifest: one(manifestsTable, {
    fields: [manifestQuotesTable.manifestId],
    references: [manifestsTable.id],
  }),
}));
