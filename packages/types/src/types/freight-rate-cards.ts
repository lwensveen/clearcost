import { z } from 'zod/v4';
import {
  FreightRateCardByIdSchema,
  FreightRateCardInsertSchema,
  FreightRateCardSelectCoercedSchema,
  FreightRateCardSelectSchema,
  FreightRateCardsListQuerySchema,
  FreightRateCardUpdateSchema,
} from '../schemas/index.js';

export type FreightRateCard = z.infer<typeof FreightRateCardSelectSchema>;
export type FreightRateCardCoerced = z.infer<typeof FreightRateCardSelectCoercedSchema>;
export type FreightRateCardInsert = z.infer<typeof FreightRateCardInsertSchema>;
export type FreightRateCardUpdate = z.infer<typeof FreightRateCardUpdateSchema>;
export type FreightRateCardById = z.infer<typeof FreightRateCardByIdSchema>;
export type FreightRateCardsListQuery = z.infer<typeof FreightRateCardsListQuerySchema>;
