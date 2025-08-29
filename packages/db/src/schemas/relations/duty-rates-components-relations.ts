import { relations } from 'drizzle-orm';
import { dutyRateComponentsTable } from '../duty-rate-components.js';
import { dutyRatesTable } from '../duty-rates.js';

export const dutyRateComponentsRelations = relations(dutyRateComponentsTable, ({ one }) => ({
  dutyRate: one(dutyRatesTable, {
    fields: [dutyRateComponentsTable.dutyRateId],
    references: [dutyRatesTable.id],
  }),
}));
