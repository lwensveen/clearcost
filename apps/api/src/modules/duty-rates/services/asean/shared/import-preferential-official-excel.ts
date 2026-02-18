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

export type ImportAseanPreferentialOfficialExcelOptions = {
  dest: string;
  /** http(s) URL, file:// URL, or local filesystem path */
  urlOrPath: string;
  partner?: string;
  agreement?: string;
  sheet?: string | number;
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
};

export type ImportAseanPreferentialOfficialSummary = {
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
      throw new Error(`ASEAN FTA official Excel download failed ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return Buffer.from(await readFile(urlOrPath));
}

function normalizeDest(dest: string): string {
  const token = String(dest).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(token)) {
    throw new Error(`Invalid destination code for ASEAN official FTA import: "${dest}"`);
  }
  return token;
}

function normalizePartnerToken(value: unknown): string | null {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return null;

  const mapped = normalizePartnerLabel(raw);
  if (mapped) return mapped;

  if (/^[A-Z]{2,6}$/.test(raw)) return raw;
  return null;
}

function agreementToken(value: string | undefined): string {
  const cleaned = String(value ?? 'fta')
    .trim()
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : 'fta';
}

type ColumnMap = {
  hs: string;
  rate: string;
  notes?: string | null;
  partner?: string | null;
};

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader = pickHeader(headers, [
    'HS',
    'HS CODE',
    'HSCODE',
    'CODE',
    'AHTN',
    'AHTN CODE',
    'TARIFF CODE',
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
  const partnerHeader = pickHeader(headers, ['PARTNER', 'COUNTRY', 'PARTNER COUNTRY', 'ORIGIN']);

  if (!hsHeader || !rateHeader) return null;
  return {
    hs: hsHeader,
    rate: rateHeader,
    notes: notesHeader ?? null,
    partner: partnerHeader ?? null,
  };
}

export async function importAseanPreferentialOfficialFromExcel(
  options: ImportAseanPreferentialOfficialExcelOptions
): Promise<ImportAseanPreferentialOfficialSummary> {
  const dest = normalizeDest(options.dest);
  const defaultPartner = normalizePartnerToken(options.partner) ?? null;
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

  const inferredFromSheet = normalizePartnerToken(
    typeof options.sheet === 'string' ? options.sheet : workbook.SheetNames[0]
  );
  const inferredFromFirstRow = normalizePartnerToken(readCell(rawRows[0]!, columns.partner));
  const fallbackPartner = defaultPartner ?? inferredFromSheet ?? inferredFromFirstRow ?? 'ASEAN';

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

    const ratePct = parsePercentAdValorem(readCell(row, columns.rate), { mapFreeToZero: true });
    if (ratePct == null) {
      skipped++;
      continue;
    }

    const rowPartner = defaultPartner ?? normalizePartnerToken(readCell(row, columns.partner));
    const partner = rowPartner ?? fallbackPartner;

    const rawNotes =
      readCell(row, columns.notes) ?? row['Notes'] ?? row['Remarks'] ?? row['Comment'] ?? '';
    const notesText = String(rawNotes || '').trim() || options.agreement || undefined;

    rowsToUpsert.push({
      dest,
      partner,
      hs6,
      dutyRule: 'fta',
      source: 'official',
      ratePct,
      currency: undefined,
      notes: notesText,
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

  const agreement = agreementToken(options.agreement);
  const result = await batchUpsertDutyRatesFromStream(rowsToUpsert, {
    batchSize,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) =>
      `${dest.toLowerCase()}:${agreement}:${row.partner ?? 'group'}:${row.hs6}`,
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
