import { fetchEuPreferentialDutyRates } from './fetch-preferential.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import type { EuImportSummary } from './import-mfn.js';

export type ImportEuPreferentialParams = {
  hs6List?: string[];
  partnerGeoIds?: string[]; // e.g. ['JP','TR','1013']
  batchSize?: number; // default 5_000
  importId?: string; // provenance run id
  dryRun?: boolean;
  xml?: {
    measureUrl?: string;
    componentUrl?: string;
    geoDescUrl?: string;
    dutyExprUrl?: string;
    language?: string;
  };
};

export async function importEuPreferential(
  params: ImportEuPreferentialParams = {}
): Promise<EuImportSummary> {
  const batchSize = Math.max(1, params.batchSize ?? 5_000);

  const rows = await fetchEuPreferentialDutyRates({
    hs6List: params.hs6List,
    partnerGeoIds: params.partnerGeoIds,
    xmlMeasureUrl: params.xml?.measureUrl,
    xmlComponentUrl: params.xml?.componentUrl,
    xmlGeoDescUrl: params.xml?.geoDescUrl,
    xmlDutyExprUrl: params.xml?.dutyExprUrl,
    language: params.xml?.language,
  });

  if (!rows?.length) {
    return { ok: true, inserted: 0, updated: 0, count: 0, dryRun: Boolean(params.dryRun) };
  }

  const res = await batchUpsertDutyRatesFromStream(rows, {
    batchSize,
    dryRun: params.dryRun,
    importId: params.importId,
    source: 'official',
    makeSourceRef: (row) => `taric:fta:${row.partner ?? 'group'}:${row.hs6}`,
  });

  return {
    ok: true,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
