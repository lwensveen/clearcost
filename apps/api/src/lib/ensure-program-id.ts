import { and, eq } from 'drizzle-orm';
import { db, jurisdictionsTable, tradeProgramsTable } from '@clearcost/db';

type ProgramKind = 'fta' | 'preference' | 'trade_remedy';

export async function ensureProgramId(
  ownerCode: string, // e.g. 'US'
  code: string, // e.g. 'CA'
  defaults: { name: string; kind?: ProgramKind; notes?: string } = { name: code }
): Promise<string> {
  const owner = ownerCode.toUpperCase();
  const progCode = code.toUpperCase();

  // Resolve jurisdiction.id from its code
  const [jur] = await db
    .select({ id: jurisdictionsTable.id })
    .from(jurisdictionsTable)
    .where(eq(jurisdictionsTable.code, owner))
    .limit(1);

  if (!jur) {
    throw new Error(`Jurisdiction not found for owner code: ${owner}`);
  }

  // Try insert (unique on owner_id + code)
  const [ins] = await db
    .insert(tradeProgramsTable)
    .values({
      ownerId: jur.id,
      code: progCode,
      name: defaults.name,
      kind: (defaults.kind ?? 'fta') as ProgramKind,
      notes: defaults.notes ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: tradeProgramsTable.id });

  if (ins?.id) return ins.id;

  // Fallback: fetch existing
  const [found] = await db
    .select({ id: tradeProgramsTable.id })
    .from(tradeProgramsTable)
    .where(and(eq(tradeProgramsTable.ownerId, jur.id), eq(tradeProgramsTable.code, progCode)))
    .limit(1);

  if (!found) {
    throw new Error(`trade_program not found/created: ${owner}:${progCode}`);
  }
  return found.id;
}
