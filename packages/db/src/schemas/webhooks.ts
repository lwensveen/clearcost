import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createTimestampColumn } from '../utils.js';

export const webhookEndpointsTable = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    url: text('url').notNull(),
    secretEnc: text('secret_enc').notNull(),
    secretIv: text('secret_iv').notNull(),
    secretTag: text('secret_tag').notNull(),
    events: text('events')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    index('idx_webhook_owner_active').on(t.ownerId, t.isActive),
    index('idx_webhook_url').on(t.url),
  ]
);

export const webhookDeliveriesTable = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id').notNull(),
    event: text('event').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    attempt: integer('attempt').notNull().default(0),
    status: text('status').notNull().default('pending'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => [
    index('idx_webhook_deliveries_endpoint').on(t.endpointId, t.status),
    index('idx_webhook_deliveries_next').on(t.nextAttemptAt),
  ]
);
