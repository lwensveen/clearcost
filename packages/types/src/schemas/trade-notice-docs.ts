import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { tradeNoticeDocsTable } from '@clearcost/db';

export const TradeNoticeDocSelectSchema = createSelectSchema(tradeNoticeDocsTable);
export const TradeNoticeDocInsertSchema = createInsertSchema(tradeNoticeDocsTable);
export const TradeNoticeDocUpdateSchema = createUpdateSchema(tradeNoticeDocsTable);

export const TradeNoticeDocSelectCoercedSchema = TradeNoticeDocSelectSchema.extend({
  bytes: z.coerce.number().int().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});

export const TradeNoticeDocByIdSchema = z.object({ id: z.uuid() });

export const TradeNoticeDocsListQuerySchema = z.object({
  noticeId: z.uuid().optional(),
  mime: z.string().min(1).optional(),
  minBytes: z.coerce.number().int().nonnegative().optional(),
  maxBytes: z.coerce.number().int().nonnegative().optional(),
  hasSha: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
