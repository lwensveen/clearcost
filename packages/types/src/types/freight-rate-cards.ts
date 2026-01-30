import { z } from 'zod/v4';
import {
  FreightCardAdminCreateSchema,
  FreightCardAdminIdParamSchema,
  FreightCardAdminImportJsonBodySchema,
  FreightCardAdminImportJsonCardSchema,
  FreightCardAdminImportJsonResponseSchema,
  FreightCardAdminUpdateSchema,
  FreightCardImportSchema,
  FreightCardsAdminListResponseSchema,
  FreightCardsAdminQuerySchema,
  FreightCardsImportResponseSchema,
  FreightCardsImportSchema,
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
export type FreightCardAdminCreate = z.infer<typeof FreightCardAdminCreateSchema>;
export type FreightCardAdminUpdate = z.infer<typeof FreightCardAdminUpdateSchema>;
export type FreightCardsAdminQuery = z.infer<typeof FreightCardsAdminQuerySchema>;
export type FreightCardsAdminListResponse = z.infer<typeof FreightCardsAdminListResponseSchema>;
export type FreightCardAdminIdParam = z.infer<typeof FreightCardAdminIdParamSchema>;
export type FreightCardAdminImportJsonBody = z.infer<typeof FreightCardAdminImportJsonBodySchema>;
export type FreightCardAdminImportJsonCard = z.infer<typeof FreightCardAdminImportJsonCardSchema>;
export type FreightCardAdminImportJsonResponse = z.infer<
  typeof FreightCardAdminImportJsonResponseSchema
>;
export type FreightCardImport = z.infer<typeof FreightCardImportSchema>;
export type FreightCardsImport = z.infer<typeof FreightCardsImportSchema>;
export type FreightCardsImportResponse = z.infer<typeof FreightCardsImportResponseSchema>;
