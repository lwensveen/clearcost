import { db, importsTable, provenanceTable } from '@clearcost/db';
import { lt } from 'drizzle-orm';
import { Command } from '../runtime.js';

export const importsPrune: Command = async (args) => {
  const days = Number(args[0] ?? 90);
  const cutoff = new Date(Date.now() - days * 24 * 3600_000);

  const provRows = await db
    .delete(provenanceTable)
    .where(lt(provenanceTable.createdAt, cutoff))
    .returning({ id: provenanceTable.id });

  const importRows = await db
    .delete(importsTable)
    .where(lt(importsTable.finishedAt, cutoff))
    .returning({ id: importsTable.id });

  console.log({
    ok: true,
    prov: provRows.length,
    imports: importRows.length,
    cutoff,
  });
};
