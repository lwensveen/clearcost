import { db, importsTable } from '@clearcost/db';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';

/**
 * Mark "running" imports with old heartbeats as failed.
 *
 * @param opts                 Options bag
 * @param opts.thresholdMinutes  Consider runs stale if updatedAt < now - threshold (default: env IMPORT_STALE_MINUTES or 30)
 * @param opts.limit             Max number of rows to sweep in one call (optional; no cap if omitted)
 */
export async function sweepStaleImports(
  opts: {
    thresholdMinutes?: number;
    limit?: number;
  } = {}
) {
  const thresholdMinutes =
    opts.thresholdMinutes ??
    (process.env.IMPORT_STALE_MINUTES ? Number(process.env.IMPORT_STALE_MINUTES) : 30);

  const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

  if (opts.limit && opts.limit > 0) {
    const staleIds = await db
      .select({ id: importsTable.id })
      .from(importsTable)
      .where(and(eq(importsTable.status, 'running'), lt(importsTable.updatedAt, cutoff)))
      .orderBy(asc(importsTable.updatedAt))
      .limit(opts.limit);

    const ids = staleIds.map((r) => r.id);
    if (ids.length === 0) {
      return { ok: true as const, swept: 0, thresholdMinutes, cutoff };
    }

    const rows = await db
      .update(importsTable)
      .set({
        status: 'failed', // enum in schema
        error: `stale heartbeat > ${thresholdMinutes}m`,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(inArray(importsTable.id, ids))
      .returning({ id: importsTable.id });

    return { ok: true as const, swept: rows.length, thresholdMinutes, cutoff };
  }

  const rows = await db
    .update(importsTable)
    .set({
      status: 'failed',
      error: `stale heartbeat > ${thresholdMinutes}m`,
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(importsTable.status, 'running'), lt(importsTable.updatedAt, cutoff)))
    .returning({ id: importsTable.id });

  return { ok: true as const, swept: rows.length, thresholdMinutes, cutoff };
}
