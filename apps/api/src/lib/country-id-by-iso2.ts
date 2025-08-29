import { eq } from 'drizzle-orm';
import { countriesTable, db } from '@clearcost/db';

export async function countryIdByIso2(iso2: string): Promise<string> {
  const [row] = await db
    .select({ id: countriesTable.id })
    .from(countriesTable)
    .where(eq(countriesTable.iso2, iso2.toUpperCase()))
    .limit(1);
  if (!row) throw new Error(`Unknown country iso2=${iso2}`);
  return row.id;
}
