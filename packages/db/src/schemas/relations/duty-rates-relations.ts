import { relations } from 'drizzle-orm';
import { dutyRateComponentsTable } from '../duty-rate-components.js';
import { dutyRatesTable } from '../duty-rates.js';

export const dutyRatesRelations = relations(dutyRatesTable, ({ many }) => ({
  components: many(dutyRateComponentsTable),
}));
