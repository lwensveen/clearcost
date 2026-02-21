import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import type { DutyRateInsert } from '@clearcost/types';
import { httpFetch } from '../../../../lib/http.js';
import {
  normalizePartnerLabel,
  parsePercentAdValorem,
  pickHeader,
  readCell,
  toHs6,
} from '../../utils/parse.js';

type FetchCnPreferentialDutyRatesOptions = {
  /** http(s) URL, file:// URL, or local filesystem path */
  urlOrPath: string;
  sheet?: string | number;
  hs6List?: string[];
  partnerGeoIds?: string[];
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};

const HS_ALIASES = ['HS', 'HS CODE', 'HSCODE', 'CODE', 'TARIFF CODE', 'SUBHEADING', '税则号列'];
const PARTNER_ALIASES = ['PARTNER', 'COUNTRY', 'ORIGIN', 'FTA PARTNER', 'AGREEMENT PARTNER'];
const RATE_ALIASES = ['RATE', 'PREFERENTIAL RATE', 'FTA RATE', 'TARIFF', 'DUTY (%)', '税率'];
const NOTES_ALIASES = ['NOTES', 'REMARKS', 'COMMENT', 'AGREEMENT', '协定'];

function isHttpLike(input: string): boolean {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

async function loadBuffer(urlOrPath: string): Promise<Buffer> {
  if (isHttpLike(urlOrPath)) {
    const response = await httpFetch(urlOrPath, { redirect: 'follow', timeoutMs: 60000 });
    if (!response.ok) throw new Error(`CN FTA official source download failed ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return Buffer.from(await readFile(urlOrPath));
}

function normalizePartnerToken(value: unknown): string | undefined {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!raw) return undefined;

  const mapped = normalizePartnerLabel(raw);
  if (mapped) return mapped;

  if (raw === 'EU' || raw === 'ASEAN' || raw === 'EAEU' || raw === 'GCC') return raw;
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return undefined;
}

function normalizePartnerFilter(partnerGeoIds?: string[]): Set<string> {
  const set = new Set<string>();
  for (const partner of partnerGeoIds ?? []) {
    const normalized = normalizePartnerToken(partner);
    if (normalized) set.add(normalized);
  }
  return set;
}

function normalizeHs6Filter(hs6List?: string[]): Set<string> {
  return new Set((hs6List ?? []).map((hs6) => String(hs6).slice(0, 6)));
}

function detectLongColumns(headers: string[]): {
  hsHeader: string;
  partnerHeader: string;
  rateHeader: string;
  notesHeader?: string | null;
} | null {
  const hsHeader = pickHeader(headers, HS_ALIASES);
  const partnerHeader = pickHeader(headers, PARTNER_ALIASES);
  const rateHeader = pickHeader(headers, RATE_ALIASES);
  const notesHeader = pickHeader(headers, NOTES_ALIASES);

  if (!hsHeader || !partnerHeader || !rateHeader) return null;
  return { hsHeader, partnerHeader, rateHeader, notesHeader };
}

function nonPartnerColumn(header: string): boolean {
  const normalized = header.toUpperCase().replace(/\s+/g, '');
  return (
    HS_ALIASES.some((alias) => normalized.includes(alias.replace(/\s+/g, ''))) ||
    NOTES_ALIASES.some((alias) => normalized.includes(alias.replace(/\s+/g, ''))) ||
    normalized.includes('MFN') ||
    normalized.includes('GENERAL') ||
    normalized.includes('PROVISIONAL') ||
    normalized.includes('WTO')
  );
}

function detectWidePartnerColumns(headers: string[]): {
  hsHeader: string;
  notesHeader?: string | null;
  partnerColumns: Array<{ header: string; partner: string }>;
} | null {
  const hsHeader = pickHeader(headers, HS_ALIASES);
  if (!hsHeader) return null;

  const notesHeader = pickHeader(headers, NOTES_ALIASES);
  const partnerColumns: Array<{ header: string; partner: string }> = [];

  for (const header of headers) {
    if (header === hsHeader || header === notesHeader) continue;
    if (nonPartnerColumn(header)) continue;
    const partner = normalizePartnerToken(header);
    if (!partner) continue;
    partnerColumns.push({ header, partner });
  }

  if (partnerColumns.length === 0) return null;
  return { hsHeader, notesHeader, partnerColumns };
}

function selectedSheetNames(workbook: XLSX.WorkBook, selector?: string | number): string[] {
  if (selector === undefined) return [...workbook.SheetNames];
  if (typeof selector === 'number') {
    const idx = Math.max(0, Math.min(workbook.SheetNames.length - 1, selector));
    const name = workbook.SheetNames[idx];
    return name ? [name] : [];
  }
  if (typeof selector === 'string' && workbook.SheetNames.includes(selector)) return [selector];
  const first = workbook.SheetNames[0];
  return first ? [first] : [];
}

export async function fetchCnPreferentialDutyRates(
  options: FetchCnPreferentialDutyRatesOptions
): Promise<DutyRateInsert[]> {
  const buffer = await loadBuffer(options.urlOrPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = selectedSheetNames(workbook, options.sheet);

  const partnerAllow = normalizePartnerFilter(options.partnerGeoIds);
  const hs6Allow = normalizeHs6Filter(options.hs6List);
  const effectiveFrom = options.effectiveFrom ?? null;
  const effectiveTo = options.effectiveTo ?? null;

  const out = new Map<string, DutyRateInsert>();

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: true,
    });
    if (rows.length === 0) continue;

    const headers = Object.keys(rows[0] ?? {});
    if (headers.length === 0) continue;

    const partnerFromSheet = normalizePartnerToken(sheetName);
    const longColumns = detectLongColumns(headers);

    if (longColumns) {
      for (const row of rows) {
        const hs6 = toHs6(readCell(row, longColumns.hsHeader));
        if (!hs6) continue;
        if (hs6Allow.size > 0 && !hs6Allow.has(hs6)) continue;

        const partner =
          normalizePartnerToken(readCell(row, longColumns.partnerHeader)) ?? partnerFromSheet;
        if (!partner) continue;
        if (partnerAllow.size > 0 && !partnerAllow.has(partner)) continue;

        const ratePct = parsePercentAdValorem(readCell(row, longColumns.rateHeader), {
          mapFreeToZero: true,
        });
        if (ratePct == null) continue;

        const notesRaw = readCell(row, longColumns.notesHeader);
        const notes = String(notesRaw ?? '').trim() || undefined;
        const key = `${partner}:${hs6}`;
        if (out.has(key)) continue;

        out.set(key, {
          dest: 'CN',
          partner,
          hs6,
          dutyRule: 'fta',
          source: 'official',
          ratePct,
          effectiveFrom,
          effectiveTo,
          notes,
        });
      }
      continue;
    }

    const wideColumns = detectWidePartnerColumns(headers);
    if (!wideColumns) continue;

    for (const row of rows) {
      const hs6 = toHs6(readCell(row, wideColumns.hsHeader));
      if (!hs6) continue;
      if (hs6Allow.size > 0 && !hs6Allow.has(hs6)) continue;

      const notesRaw = readCell(row, wideColumns.notesHeader);
      const notes = String(notesRaw ?? '').trim() || undefined;

      for (const column of wideColumns.partnerColumns) {
        const partner = column.partner;
        if (partnerAllow.size > 0 && !partnerAllow.has(partner)) continue;

        const ratePct = parsePercentAdValorem(readCell(row, column.header), {
          mapFreeToZero: true,
        });
        if (ratePct == null) continue;

        const key = `${partner}:${hs6}`;
        if (out.has(key)) continue;

        out.set(key, {
          dest: 'CN',
          partner,
          hs6,
          dutyRule: 'fta',
          source: 'official',
          ratePct,
          effectiveFrom,
          effectiveTo,
          notes,
        });
      }
    }
  }

  return Array.from(out.values());
}
