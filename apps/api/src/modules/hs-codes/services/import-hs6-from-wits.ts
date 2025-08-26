import { db, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';

// WITS SDMX "TRAINS" endpoint; we piggyback a single query just to get PRODUCT values.
const SDMX_BASE = 'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS';

type ImportHs6FromWitsResult = { ok: true; count: number };

// Minimal SDMX types we need
type SdmxJson = {
  structure: {
    dimensions: {
      series: Array<{ id: string; values: Array<{ id: string; name?: string }> }>;
    };
  };
};

// Find the PRODUCT dimension index (robust to slight id name diffs)
function findSeriesDimIndex(struct: SdmxJson['structure'], candidates: string[]): number {
  const ser = struct.dimensions.series;
  const idx = ser.findIndex((d) =>
    candidates.some((c) => d.id.toUpperCase().includes(c.toUpperCase()))
  );
  if (idx < 0) throw new Error(`SDMX: missing series dim among [${candidates.join(', ')}]`);
  return idx;
}

function isHS6(code: string | undefined) {
  return !!code && /^\d{6}$/.test(code);
}

/**
 * Fetch the PRODUCT dimension (HS6 + names) from a single WITS call.
 * We query an arbitrary, stable series (reporter=USA, partner=WLD, ALL products, reported),
 * because the PRODUCT value list comes in the SDMX structure, independent of the data volume.
 */
async function fetchHs6FromWits(year: number) {
  const path = `A.usa.wld.ALL.reported`;
  const url = `${SDMX_BASE}/${path}?startPeriod=${year}&endPeriod=${year}&detail=DataOnly&format=JSON`;
  const r = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) throw new Error(`WITS fetch failed ${r.status} ${r.statusText}`);
  const json = (await r.json()) as SdmxJson;

  const PRODUCT = findSeriesDimIndex(json.structure, ['PRODUCT', 'PRODUCTCODE']);
  const values = json.structure.dimensions.series[PRODUCT]?.values ?? [];

  // De-dupe and normalize
  const out: Array<{ hs6: string; title: string }> = [];
  for (const v of values) {
    if (!isHS6(v.id)) continue;
    const title = (v.name ?? '').trim();
    out.push({ hs6: v.id, title: title || '—' });
  }
  // unique by hs6
  const uniq = new Map<string, string>();
  for (const row of out) if (!uniq.has(row.hs6)) uniq.set(row.hs6, row.title);
  return Array.from(uniq.entries()).map(([hs6, title]) => ({ hs6, title }));
}

/** Upsert HS6 rows into hs_codes; returns total affected (inserted + updated). */
export async function importHs6FromWits(year?: number): Promise<ImportHs6FromWitsResult> {
  const targetYear = year ?? new Date().getUTCFullYear() - 1; // WITS is typically T-1
  const rows = await fetchHs6FromWits(targetYear);
  if (!rows.length) return { ok: true as const, count: 0 };

  const batchSize = 2000;
  let affected = 0;

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const ret = await trx
        .insert(hsCodesTable)
        .values(
          chunk.map((r) => ({
            hs6: r.hs6,
            title: r.title,
          }))
        )
        .onConflictDoUpdate({
          target: hsCodesTable.hs6,
          set: { title: sql`excluded.title`, updatedAt: sql`now()` },
        })
        .returning({ hs6: hsCodesTable.hs6 });
      affected += ret.length;
    }
  });

  return { ok: true as const, count: affected };
}
