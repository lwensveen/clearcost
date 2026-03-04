import type { DutyRateInsert } from '@clearcost/types';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import unzipper from 'unzipper';
import * as XLSX from 'xlsx';
import { httpFetch } from '../../../../lib/http.js';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import {
  parsePercentAdValorem,
  pickHeader,
  readCell,
  resolveWorksheet,
  toHs6,
} from '../../utils/parse.js';

export type ImportIlMfnOfficialOptions = {
  /** http(s) URL, file:// URL, or local filesystem path */
  urlOrPath: string;
  sheet?: string | number;
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
};

export type ImportIlMfnOfficialSummary = {
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  dryRun: boolean;
  scanned: number;
  kept: number;
  skipped: number;
  sourceFile: string;
};

type ColumnMap = {
  hs: string;
  rate: string;
};

type ResolvedWorkbook = {
  workbookBuffer: Buffer;
  sourceFile: string;
};

function isHttpLike(input: string): boolean {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function scoreArchiveEntry(path: string): number {
  const token = path.toLowerCase();
  let score = 0;
  if (token.includes('israel')) score += 4;
  if (token.includes('gov.il')) score += 4;
  if (token.includes('tariff')) score += 4;
  if (token.includes('customs')) score += 3;
  if (token.includes('taxes')) score += 3;
  if (token.includes('schedule')) score += 2;
  if (token.endsWith('.xlsx')) score += 2;
  if (token.endsWith('.xls')) score += 1;
  if (token.endsWith('.csv')) score += 1;
  return score;
}

function detectColumns(headers: string[]): ColumnMap | null {
  const hsHeader = pickHeader(headers, [
    'HS',
    'HS CODE',
    'HSCODE',
    'TARIFF ITEM',
    'TARIFFITEM',
    'TARIFF ITEM NO',
    'TARIFF NO',
    'TARIFF NUMBER',
    'CODE',
  ]);
  const rateHeader = pickHeader(headers, [
    'MFN',
    'MFN RATE',
    'MFN TARIFF',
    'MOST FAVOURED NATION',
    'MOST-FAVOURED-NATION',
    'GENERAL TARIFF',
    'GENERAL RATE',
    'DUTY RATE',
    'RATE',
  ]);

  if (!hsHeader || !rateHeader) return null;
  return { hs: hsHeader, rate: rateHeader };
}

async function loadSourceBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow', timeoutMs: 60000 });
    if (!response.ok) {
      throw new Error(`IL MFN official source download failed ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return Buffer.from(await readFile(urlOrPath));
}

async function resolveWorkbookBuffer(urlOrPath: string): Promise<ResolvedWorkbook> {
  const sourceBuffer = await loadSourceBuffer(urlOrPath);
  const sourceName = basename(urlOrPath) || 'il-mfn-source';
  const sourceToken = sourceName.toLowerCase();
  if (
    sourceToken.endsWith('.xlsx') ||
    sourceToken.endsWith('.xls') ||
    sourceToken.endsWith('.csv')
  ) {
    return {
      workbookBuffer: sourceBuffer,
      sourceFile: sourceName,
    };
  }

  if (!isZip(sourceBuffer)) {
    return {
      workbookBuffer: sourceBuffer,
      sourceFile: sourceName,
    };
  }

  const archive = await unzipper.Open.buffer(sourceBuffer);
  const candidates = archive.files.filter(
    (entry) =>
      entry.type === 'File' &&
      /\.(xlsx|xls|csv)$/i.test(entry.path) &&
      !entry.path.toLowerCase().includes('__macosx/')
  );

  if (candidates.length === 0) {
    // XLSX files are ZIP containers; when URL/path has no useful extension,
    // fall back to treating the payload as a workbook directly.
    return {
      workbookBuffer: sourceBuffer,
      sourceFile: sourceName,
    };
  }

  const [selected] = [...candidates].sort(
    (a, b) => scoreArchiveEntry(b.path) - scoreArchiveEntry(a.path)
  );
  if (!selected) {
    throw new Error('IL MFN source ZIP did not contain a readable workbook entry');
  }
  const workbookBuffer = await selected.buffer();
  return { workbookBuffer, sourceFile: selected.path };
}

export async function importIlMfnOfficial(
  options: ImportIlMfnOfficialOptions
): Promise<ImportIlMfnOfficialSummary> {
  const batchSize = options.batchSize ?? 5_000;
  const resolved = await resolveWorkbookBuffer(options.urlOrPath);

  const workbook = XLSX.read(resolved.workbookBuffer, { type: 'buffer' });
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
      sourceFile: resolved.sourceFile,
    };
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(`Unable to detect IL MFN columns. Headers: ${headers.join(', ')}`);
  }

  const rowsToUpsert: DutyRateInsert[] = [];
  let scanned = 0;
  let kept = 0;
  let skipped = 0;

  for (const row of rawRows) {
    scanned += 1;

    const hs6 = toHs6(readCell(row, columns.hs));
    if (!hs6) {
      skipped += 1;
      continue;
    }

    const ratePct = parsePercentAdValorem(readCell(row, columns.rate), { mapFreeToZero: true });
    if (ratePct == null) {
      skipped += 1;
      continue;
    }

    rowsToUpsert.push({
      dest: 'IL',
      partner: '',
      hs6,
      source: 'official',
      dutyRule: 'mfn',
      ratePct,
      currency: undefined,
      notes: 'Israel customs tariff MFN (official)',
    });
    kept += 1;
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
      sourceFile: resolved.sourceFile,
    };
  }

  const result = await batchUpsertDutyRatesFromStream(rowsToUpsert, {
    batchSize,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) => `il:mfn:${row.hs6}`,
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
    sourceFile: resolved.sourceFile,
  };
}
