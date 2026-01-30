import { z } from 'zod/v4';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { NOTICE_STATUS_VALUES, NOTICE_TYPE_VALUES, tradeNoticesTable } from '@clearcost/db';
import { TradeNoticeDocSelectCoercedSchema } from './trade-notice-docs.js';
import { ErrorResponseSchema } from './errors.js';

export const NoticeType = z.enum(NOTICE_TYPE_VALUES);
export const NoticeStatus = z.enum(NOTICE_STATUS_VALUES);

export type NoticeTypeValue = (typeof NOTICE_TYPE_VALUES)[number];
export type NoticeStatusValue = (typeof NOTICE_STATUS_VALUES)[number];

export const TradeNoticeSelectSchema = createSelectSchema(tradeNoticesTable);
export const TradeNoticeInsertSchema = createInsertSchema(tradeNoticesTable);
export const TradeNoticeUpdateSchema = createUpdateSchema(tradeNoticesTable);

export const TradeNoticeSelectCoercedSchema = TradeNoticeSelectSchema.extend({
  publishedAt: z.coerce.date().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  fetchedAt: z.coerce.date().optional(),
  parsedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export const TradeNoticeByIdSchema = z.object({ id: z.string().uuid() });

export const TradeNoticesListQuerySchema = z.object({
  dest: z.string().length(2).optional(),
  authority: z.string().min(1).optional(),
  type: NoticeType.optional(),
  status: NoticeStatus.optional(),
  lang: z.string().min(2).max(8).optional(),
  q: z.string().min(1).optional(),
  tags: z.string().optional(),
  publishedFrom: z.coerce.date().optional(),
  publishedTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['publishedAt', 'createdAt', 'updatedAt']).default('publishedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export const TradeNoticesListResponseSchema = z.object({
  ok: z.literal(true),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nullable(),
  items: z.array(TradeNoticeSelectCoercedSchema),
});

export const TradeNoticeDetailResponseSchema = z.object({
  ok: z.literal(true),
  notice: TradeNoticeSelectCoercedSchema,
  docs: z.array(TradeNoticeDocSelectCoercedSchema),
});

export const TradeNoticeErrorResponseSchema = ErrorResponseSchema;
