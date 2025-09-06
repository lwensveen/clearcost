import type { DutyRateInsert } from '@clearcost/types';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { parsePercentAdValorem, toHs6 } from '../../../utils/parse.js';

export type ImportPhMfnParams = {
  urlOrPath: string;
  sheet?: string | number;
  mapFreeToZero?: boolean;
  skipSpecific?: boolean;
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
};

export type ImportSummary = {
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  dryRun: boolean;
  scanned: number;
  kept: number;
  skipped: number;
};

const DEFAULTS: Required<Pick<ImportPhMfnParams, 'mapFreeToZero' | 'skipSpecific' | 'batchSize'>> =
  {
    mapFreeToZero: true,
    skipSpecific: true,
    batchSize: 5_000,
  };

function isHttpLike(input: string) {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const res = await fetch(urlOrPath, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const file = await readFile(urlOrPath);
  return Buffer.from(file);
}

type ColumnMap = { hs: string; rate: string };

function pickColumns(headers: string[]): ColumnMap | null {
  const HS_HINTS = ['HS', 'HS CODE', 'HSCODE', 'HEADING', 'SUBHEADING', 'ASEAN HSCODE', 'CODE'];
  const RATE_HINTS = ['MFN', 'AD VALOREM', 'BASIC RATE', 'BASIC', 'DUTY RATE', 'RATE'];
  const norm = (h: string) => h.trim().toUpperCase();

  let hsCol: string | undefined;
  let rateCol: string | undefined;

  for (const header of headers) {
    const H = norm(header);
    if (!hsCol && HS_HINTS.some((hint) => H.includes(hint))) hsCol = header;
    if (!rateCol && RATE_HINTS.some((hint) => H.includes(hint))) rateCol = header;
  }

  return hsCol && rateCol ? { hs: hsCol, rate: rateCol } : null;
}

export async function importPhMfnExcel(params: ImportPhMfnParams): Promise<ImportSummary> {
  const input = { ...DEFAULTS, ...params };
  const buffer = await loadBuffer(input.urlOrPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  let sheetName: string;
  if (typeof input.sheet === 'number') {
    sheetName = workbook.SheetNames[input.sheet] ?? workbook.SheetNames[0]!;
  } else if (typeof input.sheet === 'string') {
    sheetName = input.sheet;
  } else {
    sheetName = workbook.SheetNames[0]!;
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Worksheet "${sheetName}" not found`);

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
      dryRun: !!input.dryRun,
      scanned: 0,
      kept: 0,
      skipped: 0,
    };
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const detected = pickColumns(headers);
  if (!detected)
    throw new Error(`Unable to detect HS and Rate columns. Headers: ${headers.join(', ')}`);
  const { hs: hsCol, rate: rateCol } = detected;

  let scanned = 0;
  let kept = 0;
  let skipped = 0;

  const toUpsert: DutyRateInsert[] = [];

  for (const row of rawRows) {
    scanned++;

    const hs6 = toHs6(row[hsCol]);
    if (!hs6) {
      skipped++;
      continue;
    }

    const percentString = parsePercentAdValorem(row[rateCol], {
      mapFreeToZero: input.mapFreeToZero,
    });

    if (percentString == null) {
      // Non ad-valorem or unreadable → skip
      skipped++;
      continue;
    }

    toUpsert.push({
      dest: 'PH',
      hs6,
      partner: '',
      dutyRule: 'mfn',
      source: 'official',
      ratePct: percentString,
      currency: undefined,
      notes: undefined,
    });
    kept++;
  }

  if (!toUpsert.length) {
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: !!input.dryRun,
      scanned,
      kept,
      skipped,
    };
  }

  const result = await batchUpsertDutyRatesFromStream(toUpsert, {
    batchSize: input.batchSize,
    dryRun: input.dryRun,
    importId: input.importId,
    source: 'official',
    makeSourceRef: (row) => `ph:mfn:${row.hs6}`,
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
