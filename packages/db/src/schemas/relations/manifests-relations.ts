import { relations } from 'drizzle-orm';
import { manifestItemsTable } from '../manifest-items.js';
import { manifestItemQuotesTable } from '../manifest-item-quotes.js';
import { manifestQuotesTable } from '../manifest-quotes.js';
import { manifestsTable } from '../manifests.js';

export const manifestsRelations = relations(manifestsTable, ({ many }) => ({
  items: many(manifestItemsTable),
  itemQuotes: many(manifestItemQuotesTable),
  quotes: many(manifestQuotesTable),
}));
