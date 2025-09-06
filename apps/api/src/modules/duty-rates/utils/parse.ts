import type * as XLSX from 'xlsx';

/** Strip non-digits and return first 6 digits if present; else null. */
export function toHs6(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

/**
 * Parse an ad-valorem rate like "5", "5%", "12.5 %".
 * Returns a normalized numeric string (e.g., "5", "12.5") or null if not ad-valorem/unknown.
 * If `mapFreeToZero` is true, "FREE"/"EXEMPT"/"0%"/"0" → "0".
 */
export function parsePercentAdValorem(
  value: unknown,
  options?: { mapFreeToZero?: boolean }
): string | null {
  const mapFreeToZero = options?.mapFreeToZero ?? true;

  if (value == null) return null;
  const text = String(value).trim();

  if (!text) return null;

  if (mapFreeToZero) {
    const upper = text.toUpperCase();
    if (upper === 'FREE' || upper === 'EXEMPT' || upper === '0' || upper === '0%') return '0';
  }

  // Accept numbers with or without a trailing %, e.g. "5", "5%", "12.5 %"
  const match = /^(\d+(?:\.\d+)?)\s*%?$/.exec(text);
  return match?.[1] ?? null;
}

/** Safely choose a worksheet by name or index; falls back to first sheet. */
export function resolveWorksheet(
  workbook: XLSX.WorkBook,
  selector?: string | number
): XLSX.WorkSheet {
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) throw new Error('Workbook has no sheets');

  let chosenName: string;
  if (typeof selector === 'number') {
    const index = Math.max(0, Math.min(sheetNames.length - 1, selector));
    chosenName = sheetNames[index]!;
  } else if (typeof selector === 'string') {
    chosenName = sheetNames.includes(selector) ? selector : sheetNames[0]!;
  } else {
    chosenName = sheetNames[0]!;
  }

  const worksheet = workbook.Sheets[chosenName];
  if (!worksheet) throw new Error(`Worksheet "${chosenName}" not found`);
  return worksheet;
}

/** Return first header that loosely matches any of the aliases (case/space-insensitive). */
export function pickHeader(headers: string[], aliases: string[]): string | null {
  const cleanedAliases = aliases.map((a) => a.toUpperCase().replace(/\s+/g, ''));
  for (const header of headers) {
    const normalized = header.toUpperCase().replace(/\s+/g, '');
    if (cleanedAliases.some((alias) => normalized.includes(alias))) return header;
  }
  return null;
}

/** Safe row access to avoid TS2538 (undefined index). */
export function readCell(row: Record<string, unknown>, key?: string | null): unknown {
  return key ? row[key] : undefined;
}

/** Normalizes a partner label (“United States”, “USA”) → geo id like "US". */
export function normalizePartnerLabel(label?: string): string | undefined {
  if (!label) return undefined;
  const map: Record<string, string> = {
    ASEAN: 'ASEAN',
    BRUNEI: 'BN',
    CAMBODIA: 'KH',
    INDONESIA: 'ID',
    LAO: 'LA',
    LAOS: 'LA',
    MALAYSIA: 'MY',
    MYANMAR: 'MM',
    PHILIPPINES: 'PH',
    SINGAPORE: 'SG',
    THAILAND: 'TH',
    VIETNAM: 'VN',
    JAPAN: 'JP',
    CHINA: 'CN',
    KOREA: 'KR',
    AUSTRALIA: 'AU',
    NEWZEALAND: 'NZ',
    'NEW ZEALAND': 'NZ',
    INDIA: 'IN',
    CHILE: 'CL',
    PAKISTAN: 'PK',
    TURKIYE: 'TR',
    TURKEY: 'TR',
    EU: 'EU',
    UK: 'GB',
    USA: 'US',
    UNITEDSTATES: 'US',
    'UNITED STATES': 'US',
  };

  const compact = label.toUpperCase().replace(/\s+/g, '');
  for (const [name, code] of Object.entries(map)) {
    if (compact.includes(name.replace(/\s+/g, ''))) return code;
  }
  return undefined;
}
