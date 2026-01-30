import type { DutyRateInsert } from '@clearcost/types';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { httpFetch } from '../../../../../lib/http.js';
import {
  normalizePartnerLabel,
  parsePercentAdValorem,
  pickHeader,
  readCell,
  resolveWorksheet,
  toHs6,
} from '../../../utils/parse.js';

export type ImportMyPreferentialParams = {
  /** http(s) URL, file:// URL, or local filesystem path */
  url: string;
  /** Explicit partner geo id (overrides inference from sheet/rows) */
  partner?: string;
  /** Agreement code/text for notes & sourceRef (e.g., 'ATIGA', 'RCEP') */
  agreement?: string;
  /** Sheet name or 0-based index */
  sheet?: string | number;
  importId?: string;
  batchSize?: number;
  dryRun?: boolean;
};

function isHttpLike(input: string) {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow', timeoutMs: 60000 });
    if (!response.ok) throw new Error(`MY FTA Excel download failed ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const file = await readFile(urlOrPath);
  return Buffer.from(file);
}

type ColumnMap = { hs: string; rate: string; notes?: string | null; partner?: string | null };

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader = pickHeader(headers, [
    'HS',
    'HS CODE',
    'HSCODE',
    'CODE',
    'AHTN',
    'AHTN CODE',
    'SUBHEADING',
  ]);
  const rateHeader = pickHeader(headers, [
    'RATE',
    'PREFERENTIAL RATE',
    'TARIFF',
    'FINAL RATE',
    'ATIGA RATE',
    'DUTY (%)',
    'TARIFF (%)',
  ]);
  const notesHeader = pickHeader(headers, ['NOTES', 'REMARKS', 'COMMENT']);
  const partnerHeader = pickHeader(headers, ['PARTNER', 'COUNTRY', 'PARTNER COUNTRY']);

  if (!hsHeader || !rateHeader) return null;
  return {
    hs: hsHeader,
    rate: rateHeader,
    notes: notesHeader ?? null,
    partner: partnerHeader ?? null,
  };
}

export async function importMyPreferentialFromExcel(options: ImportMyPreferentialParams) {
  const buffer = await loadBuffer(options.url);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = resolveWorksheet(workbook, options.sheet);

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true,
  });

  if (!rawRows.length) {
    // no-op import (consistent return shape via the upserter)
    return batchUpsertDutyRatesFromStream([], {
      batchSize: options.batchSize ?? 5_000,
      dryRun: options.dryRun,
      importId: options.importId,
      source: 'official',
      makeSourceRef: () => `my:${(options.agreement ?? 'fta').toLowerCase()}:group:000000`,
    });
  }

  const headers = Object.keys(rawRows[0] ?? []);
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(`Unable to detect HS and Rate columns. Headers: ${headers.join(', ')}`);
  }

  // Determine partner: explicit > sheet name > first row partner-like field > 'ASEAN'
  const inferredFromSheet = normalizePartnerLabel(
    typeof options.sheet === 'string' ? options.sheet : workbook.SheetNames[0]
  );
  const firstRowPartnerValue = readCell(rawRows[0]!, columns.partner);
  const inferredFromRow = normalizePartnerLabel(
    firstRowPartnerValue == null ? undefined : String(firstRowPartnerValue)
  );

  const partnerGeoId = options.partner ?? inferredFromSheet ?? inferredFromRow ?? 'ASEAN';

  const dutyRows: DutyRateInsert[] = [];

  for (const row of rawRows) {
    const hs6 = toHs6(readCell(row, columns.hs));
    if (!hs6) continue;

    const ratePct = parsePercentAdValorem(readCell(row, columns.rate), { mapFreeToZero: true });
    if (ratePct == null) continue; // skip specific/compound for now

    const rawNotesValue =
      readCell(row, columns.notes) ??
      (row as any).Notes ??
      (row as any).Remarks ??
      (row as any).Comment ??
      '';
    const notesText = String(rawNotesValue || '').trim() || options.agreement || undefined;

    dutyRows.push({
      dest: 'MY',
      partner: partnerGeoId,
      hs6,
      dutyRule: 'fta',
      source: 'official',
      ratePct, // schema expects string
      currency: undefined,
      notes: notesText,
    });
  }

  return batchUpsertDutyRatesFromStream(dutyRows, {
    batchSize: options.batchSize ?? 5_000,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) =>
      `my:${(options.agreement ?? 'fta').toLowerCase()}:${row.partner ?? 'group'}:${row.hs6}`,
  });
}
