import { PgTimestampConfig, timestamp } from 'drizzle-orm/pg-core';

export const defaultTimestampOptions: PgTimestampConfig = {
  withTimezone: true,
  mode: 'date',
};

export const createTimestampColumn = (columnName: string, isUpdatedColumn = false) => {
  const column = timestamp(columnName, defaultTimestampOptions).notNull().defaultNow();
  return isUpdatedColumn ? column.$onUpdateFn(() => new Date()) : column;
};
