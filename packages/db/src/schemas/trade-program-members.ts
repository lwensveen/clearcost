import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createTimestampColumn } from '../utils.js';
import { countriesTable } from './countries.js';
import { tradeProgramsTable } from './trade-programs.js';

export const tradeProgramMembersTable = pgTable(
  'trade_program_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => tradeProgramsTable.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countriesTable.id, { onDelete: 'restrict' }),
    effectiveFrom: createTimestampColumn('effective_from', { defaultNow: true }),
    effectiveTo: createTimestampColumn('effective_to', { nullable: true }),
    notes: text('notes'),
    createdAt: createTimestampColumn('created_at', { defaultNow: true }),
    updatedAt: createTimestampColumn('updated_at', { defaultNow: true, onUpdate: true }),
  },
  (t) => ({
    uq: uniqueIndex('trade_program_members_program_country_from_uq').on(
      t.programId,
      t.countryId,
      t.effectiveFrom
    ),
    idxProgram: index('trade_program_members_program_idx').on(t.programId),
    idxCountry: index('trade_program_members_country_idx').on(t.countryId),
  })
);
