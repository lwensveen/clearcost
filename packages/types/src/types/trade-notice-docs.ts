import { z } from 'zod/v4';
import {
  TradeNoticeDocByIdSchema,
  TradeNoticeDocInsertSchema,
  TradeNoticeDocSelectCoercedSchema,
  TradeNoticeDocSelectSchema,
  TradeNoticeDocsListQuerySchema,
  TradeNoticeDocUpdateSchema,
} from '../schemas/trade-notice-docs.js';

export type TradeNoticeDoc = z.infer<typeof TradeNoticeDocSelectSchema>;
export type TradeNoticeDocCoerced = z.infer<typeof TradeNoticeDocSelectCoercedSchema>;
export type TradeNoticeDocInsert = z.infer<typeof TradeNoticeDocInsertSchema>;
export type TradeNoticeDocUpdate = z.infer<typeof TradeNoticeDocUpdateSchema>;
export type TradeNoticeDocById = z.infer<typeof TradeNoticeDocByIdSchema>;
export type TradeNoticeDocsListQuery = z.infer<typeof TradeNoticeDocsListQuerySchema>;
