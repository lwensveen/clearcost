import { z } from 'zod/v4';
import {
  TradeNoticeByIdSchema,
  TradeNoticeInsertSchema,
  TradeNoticeSelectCoercedSchema,
  TradeNoticeSelectSchema,
  TradeNoticesListQuerySchema,
  TradeNoticeUpdateSchema,
} from '../schemas/trade-notices.js';

export type TradeNotice = z.infer<typeof TradeNoticeSelectSchema>;
export type TradeNoticeCoerced = z.infer<typeof TradeNoticeSelectCoercedSchema>;
export type TradeNoticeInsert = z.infer<typeof TradeNoticeInsertSchema>;
export type TradeNoticeUpdate = z.infer<typeof TradeNoticeUpdateSchema>;
export type TradeNoticeById = z.infer<typeof TradeNoticeByIdSchema>;
export type TradeNoticesListQuery = z.infer<typeof TradeNoticesListQuerySchema>;
