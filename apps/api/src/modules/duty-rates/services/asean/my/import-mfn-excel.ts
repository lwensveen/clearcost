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

export type ImportMyMfnOptions = {
  /** http(s) URL, file:// URL, or local filesystem path */
  url: string;
  /** Worksheet name or 0-based index */
  sheet?: string | number;
  importId?: string;
  batchSize?: number;
  dryRun?: boolean;
};

type ColumnMap = {
  hs: string;
  rate: string;
  notes?: string | null;
};

function isHttpLike(input: string) {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow', timeoutMs: 60000 });
    if (!response.ok) throw new Error(`MY MFN Excel download failed ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const fileBuffer = await readFile(urlOrPath);
  return Buffer.from(fileBuffer);
}

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader = pickHeader(headers, [
    'HS',
    'HS CODE',
    'TARIFF CODE',
    'AHTN CODE',
    'CODE',
    'CUSTOMS TARIFF CODE',
    'HSCODE',
  ]);
  const rateHeader = pickHeader(headers, [
    'RATE',
    'RATE %',
    'DUTY',
    'IMPORT DUTY',
    'AD VALOREM',
    'TARIFF (%)',
    'BASIC RATE',
    'BASIC',
  ]);
  const notesHeader = pickHeader(headers, ['NOTES', 'REMARKS', 'COMMENT']) ?? null;

  if (!hsHeader || !rateHeader) return null;
  return { hs: hsHeader, rate: rateHeader, notes: notesHeader };
}

export async function importMyMfnFromExcel(options: ImportMyMfnOptions) {
  const buffer = await loadBuffer(options.url);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = resolveWorksheet(workbook, options.sheet);

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true,
  });

  if (!rawRows.length) {
    // no-op: return standard upserter result shape
    return batchUpsertDutyRatesFromStream([], {
      batchSize: options.batchSize ?? 5_000,
      dryRun: options.dryRun,
      importId: options.importId,
      source: 'official',
      makeSourceRef: () => `my:excel/mfn:000000`,
    });
  }

  const headers = Object.keys(rawRows[0] ?? []);
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(`Unable to detect HS and Rate columns. Headers: ${headers.join(', ')}`);
  }

  const rowsToUpsert: DutyRateInsert[] = [];

  for (const row of rawRows) {
    const hs6Code = toHs6(readCell(row, columns.hs));
    if (!hs6Code) continue;

    // Treat FREE/0% etc. as "0"; skip specific/compound rates
    const adValoremPct = parsePercentAdValorem(readCell(row, columns.rate), {
      mapFreeToZero: true,
    });
    if (adValoremPct == null) continue;

    const rawNotes = readCell(row, columns.notes) ?? row.Notes ?? row.Remarks ?? row.Comment ?? '';
    const notesText = String(rawNotes || '').trim() || undefined;

    rowsToUpsert.push({
      dest: 'MY',
      partner: '', // MFN sentinel
      hs6: hs6Code,
      dutyRule: 'mfn',
      ratePct: adValoremPct, // schema expects string
      currency: undefined,
      notes: notesText,
      source: 'official',
    });
  }

  return batchUpsertDutyRatesFromStream(rowsToUpsert, {
    batchSize: options.batchSize ?? 5_000,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) => `my:excel/mfn:${row.hs6}`,
  });
}
