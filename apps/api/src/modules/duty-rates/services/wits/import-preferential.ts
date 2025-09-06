import type { DutyRateInsert } from '@clearcost/types';
import { fetchWitsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

function efIso(d: DutyRateInsert['effectiveFrom']): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

/**
 * Preferential (FTA) duties via WITS/UNCTAD (PRF only — no MFN).
 * Upserts in batches and records provenance as `wits:DEST:PARTNER:fta:hs6=...:ef=YYYY-MM-DD`.
 */
export async function importPreferentialFromWits(params: {
  dest: string; // ISO2 reporter (e.g., 'JP', 'ID')
  partnerGeoIds?: string[]; // ISO2/union codes (e.g., 'CN', 'KR', 'EU')
  hs6List?: string[];
  backfillYears?: number; // default 1 (current-1 and one previous year)
  batchSize?: number; // default 5000
  importId?: string;
  dryRun?: boolean;
}) {
  const dest = params.dest.toUpperCase();
  const partners = (params.partnerGeoIds ?? []).map((p) => p.toUpperCase());
  const backfillYears = Math.max(0, params.backfillYears ?? 1);
  const batchSize = Math.max(1, params.batchSize ?? 5000);

  let inserted = 0;
  let updated = 0;
  let count = 0;

  for (const partner of partners) {
    const rows = await fetchWitsPreferentialDutyRates({
      dest,
      partner,
      backfillYears,
      hs6List: params.hs6List,
    }).catch(() => [] as DutyRateInsert[]);

    if (!rows.length) continue;

    const res = await batchUpsertDutyRatesFromStream(rows, {
      batchSize,
      importId: params.importId,
      dryRun: params.dryRun,
      source: 'wits',
      makeSourceRef: (r) => `wits:${dest}:${partner}:fta:hs6=${r.hs6}:ef=${efIso(r.effectiveFrom)}`,
    });

    inserted += res.inserted;
    updated += res.updated;
    count += res.count;
  }

  return {
    ok: true as const,
    inserted,
    updated,
    count,
    dryRun: !!params.dryRun,
  };
}
