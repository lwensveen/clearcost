import type { InferSelectModel } from 'drizzle-orm';
import { apiKeysTable } from '@clearcost/db';

type ApiKeyRow = Pick<InferSelectModel<typeof apiKeysTable>, 'isDemo'>;

export function isDemoKey(apiKey: ApiKeyRow): boolean {
  return apiKey.isDemo === true;
}
