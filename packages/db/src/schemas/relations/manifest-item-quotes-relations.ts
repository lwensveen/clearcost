import { relations } from 'drizzle-orm';
import { manifestItemQuotesTable } from '../manifest-item-quotes.js';
import { manifestItemsTable } from '../manifest-items.js';
import { manifestsTable } from '../manifests.js';

export const manifestItemQuotesRelations = relations(manifestItemQuotesTable, ({ one }) => ({
  manifest: one(manifestsTable, {
    fields: [manifestItemQuotesTable.manifestId],
    references: [manifestsTable.id],
  }),
  item: one(manifestItemsTable, {
    fields: [manifestItemQuotesTable.itemId],
    references: [manifestItemsTable.id],
  }),
}));
