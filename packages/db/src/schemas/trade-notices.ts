import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { noticeStatusEnum, noticeTypeEnum } from '../enums.js';

export const tradeNoticesTable = pgTable(
  'trade_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dest: varchar('dest', { length: 2 }).notNull(), // ISO2, e.g., 'CN'
    authority: varchar('authority', { length: 64 }).notNull(), // e.g., 'MOF', 'GACC', 'Tariff Commission'
    type: noticeTypeEnum('type').notNull().default('general'),
    lang: varchar('lang', { length: 8 }).default('zh').notNull(), // 'zh', 'en', etc.
    title: text('title').notNull(),
    url: text('url').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: false }),
    effectiveFrom: timestamp('effective_from', { withTimezone: false }),
    effectiveTo: timestamp('effective_to', { withTimezone: false }),
    status: noticeStatusEnum('status').notNull().default('new'),
    sha256: varchar('sha256', { length: 64 }), // of the primary doc
    fetchedAt: timestamp('fetched_at', { withTimezone: false }),
    parsedAt: timestamp('parsed_at', { withTimezone: false }),
    error: text('error'),
    summary: text('summary'),
    tags: jsonb('tags'), // e.g., ["2025","list-2","steel"]
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('trade_notices_url_uq').on(t.url),
    index('trade_notices_dest_status_idx').on(t.dest, t.status),
    index('trade_notices_published_idx').on(t.publishedAt),
    index('trade_notices_type_idx').on(t.type),
  ]
);
