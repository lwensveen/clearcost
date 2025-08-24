import {
  bigint,
  date,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';

export const apiUsageTable = pgTable(
  'api_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id').notNull(),
    day: date('day', { mode: 'date' }).notNull(), // YYYY-MM-DD (UTC)
    route: text('route').notNull(), // e.g. /v1/quotes
    method: varchar('method', { length: 8 }).notNull(), // GET/POST/...
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    sumDurationMs: bigint('sum_duration_ms', { mode: 'number' }).notNull().default(0),
    sumBytesIn: bigint('sum_bytes_in', { mode: 'number' }).notNull().default(0),
    sumBytesOut: bigint('sum_bytes_out', { mode: 'number' }).notNull().default(0),
    lastAt: createTimestampColumn('last_at', { defaultNow: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uxDayKeyRoute: uniqueIndex('ux_usage_day_key_route_method').on(
      t.apiKeyId,
      t.day,
      t.route,
      t.method
    ),
    idxDay: index('idx_usage_day').on(t.day),
    idxKey: index('idx_usage_key').on(t.apiKeyId),
  })
);
