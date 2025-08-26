import { db, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';

export type ImportSummary = {
  id: string;
  lastAt: Date | null;
  ok: boolean;
  rows24h: number;
  total: number;
};

export async function getImportSummaries(thresholdHours = 36): Promise<{
  now: Date;
  thresholdHours: number;
  imports: ImportSummary[];
}> {
  const q = sql<{
    import_id: string | null;
    last_at: Date | string | null;
    rows_24h: number | string;
    total_rows: number | string;
  }>`
    SELECT
      import_id,
      MAX(created_at) AS last_at,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS rows_24h,
      COUNT(*) AS total_rows
    FROM ${provenanceTable}
    WHERE import_id IS NOT NULL
    GROUP BY import_id
    ORDER BY import_id ASC
  `;
  const rows = await db.execute(q);

  const now = new Date();
  const threshold = new Date(now.getTime() - thresholdHours * 3600_000);

  const imports: ImportSummary[] = rows.map((r) => {
    const id = String(r.import_id ?? 'unknown');
    const lastAt = r.last_at ? new Date(r.last_at as any) : null;
    return {
      id,
      lastAt,
      ok: lastAt ? lastAt >= threshold : false,
      rows24h: Number(r.rows_24h ?? 0),
      total: Number(r.total_rows ?? 0),
    };
  });

  imports.sort(
    (a, b) => Number(a.ok) - Number(b.ok) || (a.lastAt?.getTime() ?? 0) - (b.lastAt?.getTime() ?? 0)
  );

  return { now, thresholdHours, imports };
}
