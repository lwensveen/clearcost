import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  sourceAuthStrategyEnum,
  sourceDatasetEnum,
  sourceExpectedFormatEnum,
  sourceScheduleHintEnum,
  sourceTypeEnum,
} from '../enums.js';
import { createTimestampColumn } from '../utils.js';
import { sql } from 'drizzle-orm';

export const sourceRegistryTable = pgTable(
  'source_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 128 }).notNull(),
    dataset: sourceDatasetEnum('dataset').notNull(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    baseUrl: text('base_url'),
    downloadUrlTemplate: text('download_url_template'),
    enabled: boolean('enabled').notNull().default(true),
    scheduleHint: sourceScheduleHintEnum('schedule_hint').notNull().default('manual'),
    expectedFormat: sourceExpectedFormatEnum('expected_format'),
    authStrategy: sourceAuthStrategyEnum('auth_strategy').notNull().default('none'),
    secretEnvVarNames: text('secret_env_var_names')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    parserVersion: varchar('parser_version', { length: 32 }).notNull().default('v1'),
    notes: text('notes'),
    lastVerifiedAt: createTimestampColumn('last_verified_at', {
      nullable: true,
      defaultNow: false,
    }),
    slaMaxAgeHours: integer('sla_max_age_hours'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    keyUnique: uniqueIndex('source_registry_key_uq').on(t.key),
    datasetIdx: index('source_registry_dataset_idx').on(t.dataset),
    enabledIdx: index('source_registry_enabled_idx').on(t.enabled),
  })
);
