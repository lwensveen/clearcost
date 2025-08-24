import { categoriesTable, db } from '@clearcost/db';
import { eq } from 'drizzle-orm';

export async function resolveHs6(categoryKey: string, userHs6?: string) {
  if (userHs6) return userHs6;

  const row = await db
    .select({ defaultHs6: categoriesTable.defaultHs6 })
    .from(categoriesTable)
    .where(eq(categoriesTable.key, categoryKey))
    .limit(1);

  if (!row[0]) throw new Error('Unknown category');

  return row[0].defaultHs6;
}
