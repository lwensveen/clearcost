import { z } from 'zod/v4';
import {
  AuditQuoteByIdSchema,
  AuditQuoteInsertSchema,
  AuditQuoteSelectCoercedSchema,
  AuditQuoteSelectSchema,
  AuditQuotesListQuerySchema,
  AuditQuoteUpdateSchema,
} from '../schemas/index.js';

export type AuditQuote = z.infer<typeof AuditQuoteSelectSchema>;
export type AuditQuoteCoerced = z.infer<typeof AuditQuoteSelectCoercedSchema>;
export type AuditQuoteInsert = z.infer<typeof AuditQuoteInsertSchema>;
export type AuditQuoteUpdate = z.infer<typeof AuditQuoteUpdateSchema>;
export type AuditQuoteById = z.infer<typeof AuditQuoteByIdSchema>;
export type AuditQuotesListQuery = z.infer<typeof AuditQuotesListQuerySchema>;
