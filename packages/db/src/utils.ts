import { PgTimestampConfig, timestamp } from 'drizzle-orm/pg-core';

export const defaultTimestampOptions: PgTimestampConfig = {
  withTimezone: true,
  mode: 'date',
};

type TsOpts = {
  nullable?: boolean;
  defaultNow?: boolean;
  onUpdate?: boolean;
};

export const createTimestampColumn = (columnName: string, opts: TsOpts = {}) => {
  const { nullable = false, defaultNow = true, onUpdate = false } = opts;

  let col = timestamp(columnName, defaultTimestampOptions);
  if (!nullable) col = col.notNull();
  if (defaultNow) col = col.defaultNow();
  if (onUpdate) col = col.$onUpdateFn(() => new Date());
  return col;
};
