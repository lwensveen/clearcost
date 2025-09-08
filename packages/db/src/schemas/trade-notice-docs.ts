import { index, integer, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { tradeNoticesTable } from './trade-notices.js';

export const tradeNoticeDocsTable = pgTable(
  'trade_notice_docs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => tradeNoticesTable.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    mime: varchar('mime', { length: 64 }),
    bytes: integer('bytes'),
    sha256: varchar('sha256', { length: 64 }),
    storageRef: text('storage_ref'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    uniqueIndex('trade_notice_docs_notice_url_uq').on(t.noticeId, t.url),
    index('trade_notice_docs_notice_idx').on(t.noticeId),
  ]
);
