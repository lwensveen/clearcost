import { relations } from 'drizzle-orm';
import { manifestItemsTable } from '../manifest-items.js';
import { manifestItemQuotesTable } from '../manifest-item-quotes.js';
import { manifestsTable } from '../manifests.js';

export const manifestItemsRelations = relations(manifestItemsTable, ({ one, many }) => ({
  manifest: one(manifestsTable, {
    fields: [manifestItemsTable.manifestId],
    references: [manifestsTable.id],
  }),
  quotes: many(manifestItemQuotesTable),
}));
