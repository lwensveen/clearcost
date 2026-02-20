import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import type { DutyRateInsert } from '@clearcost/types';
import { parsePercentAdValorem, toHs6 } from '../../../utils/parse.js';
import { httpFetch } from '../../../../../lib/http.js';

type ColumnMap = {
  hs: string;
  mfn: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

function isHttpLike(input: string) {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow' });
    if (!response.ok) throw new Error(`ID BTKI Excel download failed ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const file = await readFile(urlOrPath);
  return Buffer.from(file);
}

function resolveWorksheet(workbook: XLSX.WorkBook, selector?: string) {
  const sheetName = selector ?? workbook.SheetNames[0]!;
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Sheet not found: ${sheetName}`);
  return worksheet;
}

function firstPresentHeader(headers: string[], candidates: string[]): string | null {
  const upper = headers.map((h) => h.toUpperCase());
  for (const candidate of candidates) {
    const idx = upper.indexOf(candidate.toUpperCase());
    if (idx >= 0) return headers[idx]!;
  }
  return null;
}

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader =
    firstPresentHeader(headers, [
      'HS',
      'HS CODE',
      'KODE HS',
      'CUSTOMS TARIFF CODE',
      'HSCODE',
      'CODE',
    ]) ?? null;

  const mfnHeader =
    firstPresentHeader(headers, ['MFN', 'BM MFN', 'BEA MASUK', 'BM', 'BASIC RATE', 'AD VALOREM']) ??
    null;

  // Optional date columns if present in workbook
  const fromHeader = firstPresentHeader(headers, ['EFFECTIVE FROM', 'EFEKTIF DARI']) ?? null;
  const toHeader = firstPresentHeader(headers, ['EFFECTIVE TO', 'EFEKTIF SAMPAI']) ?? null;

  if (!hsHeader || !mfnHeader) return null;
  return { hs: hsHeader, mfn: mfnHeader, effectiveFrom: fromHeader, effectiveTo: toHeader };
}

// Safe row accessor to avoid TS index type issues when header may be null/undefined
function readCell(
  row: Record<string, unknown>,
  key: string | null | undefined
): unknown | undefined {
  return key ? row[key] : undefined;
}

function parseMaybeDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(+date) ? undefined : date;
}

export async function fetchIdMfnDutyRates(urlOrPathOverride?: string): Promise<DutyRateInsert[]> {
  const urlOrPath = urlOrPathOverride ?? process.env.ID_BTKI_XLSX_URL;
  if (!urlOrPath) throw new Error('ID_BTKI_XLSX_URL is not set');

  const buffer = await loadBuffer(urlOrPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Prefer explicit env sheet; otherwise take the first
  const worksheet = resolveWorksheet(workbook, process.env.ID_BTKI_SHEET);

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    raw: true,
  });
  if (!rawRows.length) return [];

  // Allow env overrides for column names; otherwise detect
  const headers = Object.keys(rawRows[0] ?? {});
  const detected = detectColumns(headers);
  if (!detected) {
    throw new Error(
      `Unable to detect HS/MFN columns. Headers: ${headers.join(', ')}. You can set ID_BTKI_COL_HS and ID_BTKI_COL_MFN.`
    );
  }

  const hsHeader = process.env.ID_BTKI_COL_HS ?? detected.hs;
  const mfnHeader = process.env.ID_BTKI_COL_MFN ?? detected.mfn;
  const fromHeader = process.env.ID_BTKI_COL_FROM ?? detected.effectiveFrom ?? undefined;
  const toHeader = process.env.ID_BTKI_COL_TO ?? detected.effectiveTo ?? undefined;

  const effectiveFromEnv = process.env.ID_BTKI_EFFECTIVE_FROM
    ? parseMaybeDate(process.env.ID_BTKI_EFFECTIVE_FROM)
    : undefined;

  const results: DutyRateInsert[] = [];

  for (const row of rawRows) {
    const hsRaw = readCell(row, hsHeader);
    const hs6 = toHs6(String(hsRaw ?? ''));
    if (!hs6) continue;

    const mfnRaw = readCell(row, mfnHeader);
    const ratePctString = parsePercentAdValorem(mfnRaw, { mapFreeToZero: true });
    if (ratePctString == null) continue; // skip non-ad valorem or unreadable cells

    const effectiveFrom =
      (fromHeader ? parseMaybeDate(readCell(row, fromHeader)) : undefined) ?? effectiveFromEnv;
    const effectiveTo = toHeader ? parseMaybeDate(readCell(row, toHeader)) : undefined;

    results.push({
      dest: 'ID',
      partner: '', // MFN sentinel
      hs6,
      dutyRule: 'mfn',
      ratePct: ratePctString, // schema expects string
      effectiveFrom,
      effectiveTo,
      notes: undefined,
      source: 'official',
      currency: undefined,
    });
  }

  return results;
}
