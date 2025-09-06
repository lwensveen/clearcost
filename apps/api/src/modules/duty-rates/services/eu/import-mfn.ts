import { fetchEuMfnDutyRates } from './fetch-mfn.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';

export type EuImportSummary = {
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  dryRun: boolean;
};

export type ImportEuMfnParams = {
  hs6List?: string[];
  batchSize?: number; // default 5_000
  importId?: string; // provenance run id
  dryRun?: boolean;
  xml?: {
    measureUrl?: string;
    componentUrl?: string;
    dutyExprUrl?: string;
    language?: string; // 'EN' by default upstream
  };
};

export async function importEuMfn(params: ImportEuMfnParams = {}): Promise<EuImportSummary> {
  const batchSize = Math.max(1, params.batchSize ?? 5_000);

  const rows = await fetchEuMfnDutyRates({
    hs6List: params.hs6List,
    xmlMeasureUrl: params.xml?.measureUrl,
    xmlComponentUrl: params.xml?.componentUrl,
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
    makeSourceRef: (row) => `taric:mfn:${row.hs6}`,
  });

  return {
    ok: true,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    dryRun: res.dryRun,
  };
}
