import { z } from 'zod/v4';
import {
  VatAdminCreateSchema,
  VatAdminIdParamSchema,
  VatAdminImportJsonBodySchema,
  VatAdminImportJsonResponseSchema,
  VatAdminImportResponseSchema,
  VatAdminListQuerySchema,
  VatAdminListResponseSchema,
  VatAdminUpdateSchema,
  VatBaseSchema,
  VatRuleByIdSchema,
  VatRuleInsertSchema,
  VatRuleSelectCoercedSchema,
  VatRuleSelectSchema,
  VatRulesListQuerySchema,
  VatRuleUpdateSchema,
} from '../schemas/index.js';

export type VatRule = z.infer<typeof VatRuleSelectSchema>;
export type VatRuleCoerced = z.infer<typeof VatRuleSelectCoercedSchema>;
export type VatRuleInsert = z.infer<typeof VatRuleInsertSchema>;
export type VatRuleUpdate = z.infer<typeof VatRuleUpdateSchema>;
export type VatRuleById = z.infer<typeof VatRuleByIdSchema>;
export type VatRulesListQuery = z.infer<typeof VatRulesListQuerySchema>;
export type VatBase = z.infer<typeof VatBaseSchema>;
export type VatAdminCreate = z.infer<typeof VatAdminCreateSchema>;
export type VatAdminUpdate = z.infer<typeof VatAdminUpdateSchema>;
export type VatAdminListQuery = z.infer<typeof VatAdminListQuerySchema>;
export type VatAdminListResponse = z.infer<typeof VatAdminListResponseSchema>;
export type VatAdminIdParam = z.infer<typeof VatAdminIdParamSchema>;
export type VatAdminImportJsonBody = z.infer<typeof VatAdminImportJsonBodySchema>;
export type VatAdminImportJsonResponse = z.infer<typeof VatAdminImportJsonResponseSchema>;
export type VatAdminImportResponse = z.infer<typeof VatAdminImportResponseSchema>;
