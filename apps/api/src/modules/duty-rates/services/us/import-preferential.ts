import { fetchUsPreferentialDutyRates } from './preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

export async function importUsPreferential({
  effectiveFrom,
  skipFree,
  importId,
  owner,
  membershipCsvUrl,
}: {
  effectiveFrom?: Date;
  skipFree?: boolean;
  importId?: string;
  owner?: string;
  membershipCsvUrl?: string;
} = {}) {
  if (DEBUG) {
    console.log('[US Duties] FTA starting', {
      effectiveFrom: effectiveFrom ? effectiveFrom.toISOString() : null,
      skipFree: skipFree,
      importId: importId ?? null,
      owner: owner ?? 'US',
      membershipCsvUrl: membershipCsvUrl ?? null,
    });
  }

  const rows = await fetchUsPreferentialDutyRates({
    effectiveFrom,
    skipFree,
    owner,
    membershipCsvUrl,
  });

  if (DEBUG) {
    const hs6Set = new Set(rows.map((r) => r.hs6));
    console.log('[US Duties] FTA fetched/parsed', {
      rows: rows.length,
      distinctHs6: hs6Set.size,
      sample: rows.slice(0, 3),
    });
    if (rows.length === 0) {
      console.warn(
        '[US Duties] FTA: produced 0 rows. Check: (1) HTS export feed; (2) Special cell parse; (3) SPI membership expansion.'
      );
    }
  }

  const res = await batchUpsertDutyRatesFromStream(rows, {
    batchSize: 5000,
    importId,
    makeSourceRef: (row) => {
      const partner = row.partner ?? 'special';
      const ymd = row.effectiveFrom?.toISOString().slice(0, 10);
      const ownerTag = (owner ?? 'US').toUpperCase();
      return `usitc:hts:col1-special:owner=${ownerTag}:partner=${partner}:hs6=${row.hs6}:ef=${ymd}`;
    },
  });

  if (DEBUG) {
    console.log('[US Duties] FTA upsert result', {
      inserted: res?.inserted ?? 0,
      updated: res?.updated ?? 0,
      count: res?.count ?? (res?.inserted ?? 0) + (res?.updated ?? 0),
      dryRun: res?.dryRun ?? false,
    });
  }

  return res;
}
