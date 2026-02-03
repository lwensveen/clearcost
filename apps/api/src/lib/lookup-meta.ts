export type LookupStatus = 'ok' | 'no_match' | 'no_dataset' | 'out_of_scope' | 'error';

export type LookupMeta = {
  status: LookupStatus;
  dataset?: string | null;
  effectiveFrom?: Date | null;
  note?: string | null;
};

export type LookupResult<T> = {
  value: T;
  meta: LookupMeta;
};
