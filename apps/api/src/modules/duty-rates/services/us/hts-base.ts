// Base helpers for USITC HTS exports (JSON).
// Docs (official): REST API endpoints & export parameters.
// - API base + endpoints: https://hts.usitc.gov/reststop  (see "RESTful API")
// - Export: GET /reststop/exportList?from=0100&to=0200&format=JSON&styles=false
// - Archive & per-revision JSON available too.
// Sources: USITC External User Guide (REST API + export), HTS archive listing.
// (See: "Export" section & parameters in the user guide PDF.)
//
// Notes:
// - We export by 2-digit chapters (01..97) using ranges [CH00, (CH+1)00).
// - The JSON field names vary a bit across revisions; we pick by fuzzy key search.
// - We return raw records per chapter; MFN/FTA layers do the parsing.

const HTS_API_BASE = process.env.HTS_API_BASE ?? 'https://hts.usitc.gov';

type HtsRawRow = Record<string, unknown>;

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function rangeFrom(ch: number) {
  return `${pad2(ch)}00`;
} // e.g. 01 -> 0100
function rangeTo(ch: number) {
  return `${pad2(ch + 1)}00`;
} // exclusive end

/** Minimal GET wrapper with UA. */
export async function httpGet(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'user-agent': 'clearcost-importer', ...(init.headers || {}) },
  });
}

/** Export one chapter as JSON via HTS REST exportList. */
export async function exportChapterJson(chapter: number): Promise<HtsRawRow[]> {
  const from = rangeFrom(chapter);
  const to = rangeTo(chapter);
  const url = `${HTS_API_BASE}/reststop/exportList?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=JSON&styles=false`;
  const res = await httpGet(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTS export failed ${res.status}: ${url}\n${body}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  // HTS exports return an array of row objects.
  return json as HtsRawRow[];
}

/** Fuzzy pick a key from a row by case-insensitive includes() on the field name. */
export function pickKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (candidates.some((c) => lk.includes(c.toLowerCase()))) return k;
  }
  return null;
}

/** Parse an HTS number from a row (handles hts/htsno/etc.). Returns 10 digits if possible. */
export function parseHts10(row: Record<string, unknown>): string | null {
  const key = pickKey(row, ['htsno', 'hts no', 'hts number', 'heading/subheading', 'hts']) ?? null;
  const raw = key ? String(row[key] ?? '') : '';
  if (!raw) return null;
  // Common shape: "0101.21.0015" -> digits only
  const digits = raw.replace(/\D+/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  // Some rows are 8 digits + stat suffix key. Try to combine if present.
  const statKey = pickKey(row, ['stat suffix', 'statistical suffix', 'stat']);
  const stat = statKey
    ? String(row[statKey] ?? '')
        .replace(/\D+/g, '')
        .padStart(2, '0')
    : '';
  if (digits.length === 8 && stat.length === 2) return digits + stat;
  // Fall back to 8 digits padded with '00'
  if (digits.length === 8) return digits + '00';
  return null;
}

/** Extract the Column 1 "General" duty cell (as string) from a row. */
export function getGeneralCell(row: Record<string, unknown>): string | null {
  const key =
    pickKey(row, ['general rate of duty', 'general rate', 'general', 'column 1 general']) ?? null;
  if (!key) return null;
  const v = row[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Extract the "Special" (preferential) duty cell text from a row. */
export function getSpecialCell(row: Record<string, unknown>): string | null {
  const key = pickKey(row, ['special rate of duty', 'special rate', 'special', 'column 1 special']);
  if (!key) return null;
  const v = row[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Detect if a cell contains a pure ad-valorem rate and parse its percent (first % wins). */
export function parseAdValoremPercent(cell: string | null | undefined): number | null {
  if (!cell) return null;
  if (/^free$/i.test(cell)) return 0;
  const m = cell.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** crude compound detector: contains currency/unit cues beyond % */
export function hasCompound(cell: string | null | undefined): boolean {
  if (!cell) return false;
  return /USD|EUR|GBP|¢|cents|\bper\b|\/\s*(kg|l|m|m2|m3|pr|pair|no\.|item)/i.test(cell);
}

/** numeric(6,3) string */
export function toNumeric3String(n: number): string {
  const s = n.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}
