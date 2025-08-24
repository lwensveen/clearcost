import { z } from 'zod/v4';
import {
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
