import type { DutyRateInsert } from '@clearcost/types';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { httpFetch } from '../../../../../lib/http.js';
import {
  parsePercentAdValorem,
  pickHeader,
  readCell,
  resolveWorksheet,
  toHs6,
} from '../../../utils/parse.js';

export type ImportAseanMfnOfficialExcelOptions = {
  dest: string;
  /** http(s) URL, file:// URL, or local filesystem path */
  urlOrPath: string;
  sheet?: string | number;
  mapFreeToZero?: boolean;
  skipSpecific?: boolean;
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
};

export type ImportAseanOfficialSummary = {
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  dryRun: boolean;
  scanned: number;
  kept: number;
  skipped: number;
};

function isHttpLike(input: string) {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow', timeoutMs: 60000 });
    if (!response.ok) {
      throw new Error(`ASEAN MFN official Excel download failed ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return Buffer.from(await readFile(urlOrPath));
}

type ColumnMap = { hs: string; rate: string };

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader = pickHeader(headers, [
    'HS',
    'HS CODE',
    'HSCODE',
    'CODE',
    'TARIFF CODE',
    'AHTN CODE',
    'SUBHEADING',
    'ASEAN HSCODE',
  ]);
  const rateHeader = pickHeader(headers, [
    'RATE',
    'RATE %',
    'MFN RATE',
    'DUTY',
    'DUTY RATE',
    'IMPORT DUTY',
    'AD VALOREM',
    'TARIFF (%)',
    'BASIC RATE',
    'BASIC',
  ]);

  if (!hsHeader || !rateHeader) return null;
  return { hs: hsHeader, rate: rateHeader };
}

function normalizeDest(dest: string): string {
  const token = String(dest).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(token)) {
    throw new Error(`Invalid destination code for ASEAN official MFN import: "${dest}"`);
  }
  return token;
}

export async function importAseanMfnOfficialFromExcel(
  options: ImportAseanMfnOfficialExcelOptions
): Promise<ImportAseanOfficialSummary> {
  const dest = normalizeDest(options.dest);
  const mapFreeToZero = options.mapFreeToZero ?? true;
  const batchSize = options.batchSize ?? 5_000;

  const buffer = await loadBuffer(options.urlOrPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = resolveWorksheet(workbook, options.sheet);

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true,
  });

  if (!rawRows.length) {
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: Boolean(options.dryRun),
      scanned: 0,
      kept: 0,
      skipped: 0,
    };
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(`Unable to detect HS and Rate columns. Headers: ${headers.join(', ')}`);
  }

  let scanned = 0;
  let kept = 0;
  let skipped = 0;

  const rowsToUpsert: DutyRateInsert[] = [];

  for (const row of rawRows) {
    scanned++;

    const hs6 = toHs6(readCell(row, columns.hs));
    if (!hs6) {
      skipped++;
      continue;
    }

    const ratePct = parsePercentAdValorem(readCell(row, columns.rate), { mapFreeToZero });
    if (ratePct == null) {
      // Non ad-valorem/specific/compound rates remain unsupported in this parser.
      skipped++;
      continue;
    }

    rowsToUpsert.push({
      dest,
      partner: '',
      hs6,
      dutyRule: 'mfn',
      source: 'official',
      ratePct,
      currency: undefined,
      notes: undefined,
    });
    kept++;
  }

  if (!rowsToUpsert.length) {
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: Boolean(options.dryRun),
      scanned,
      kept,
      skipped,
    };
  }

  const result = await batchUpsertDutyRatesFromStream(rowsToUpsert, {
    batchSize,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) => `${dest.toLowerCase()}:mfn:${row.hs6}`,
  });

  return {
    ok: true,
    inserted: result.inserted,
    updated: result.updated,
    count: result.count,
    dryRun: result.dryRun,
    scanned,
    kept,
    skipped,
  };
}
