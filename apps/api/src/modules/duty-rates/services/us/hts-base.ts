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

import { UsitcClient } from './usitc-client.js';
import { DEBUG } from '../../utils/utils.js';

const HTS_BASE = process.env.HTS_API_BASE ?? 'https://hts.usitc.gov';
const HTS_CSV_URL = process.env.HTS_CSV_URL || ''; // point this at your CSV mirror or official export URL
const client = new UsitcClient(HTS_BASE);

// ---------------- tiny utils ----------------
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_\-]+/g, '')
    .trim();

function pickKey(
  obj: Record<string, unknown>,
  candidates: string[],
  { requireString = false }: { requireString?: boolean } = {}
): string | null {
  for (const k of Object.keys(obj)) {
    const nk = norm(k);
    if (candidates.some((c) => nk.includes(norm(c)))) {
      if (!requireString) return k;
      if (typeof obj[k] === 'string') return k;
    }
  }
  return null;
}

// Recursively search nested objects for a string value under any of the candidate keys.
function deepPickValue(
  obj: unknown,
  candidates: string[],
  predicate?: (val: unknown) => boolean
): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;

  const k = pickKey(rec, candidates);
  if (k && typeof rec[k] === 'string') {
    const v = rec[k] as string;
    if (!predicate || predicate(v)) return v;
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object') {
      const got = deepPickValue(v, candidates, predicate);
      if (got != null) return got;
    }
  }
  return null;
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function from4(ch: number) {
  return `${pad2(ch)}01`;
}
function to4(ch: number) {
  return `${pad2(ch)}99`;
}

// ---------------- CSV fallback (cached) ----------------
let csvCache: Record<string, unknown>[] | null = null;

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0,
    inQ = false;

  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  rows.push(row);

  const header = rows.shift() ?? [];
  const out: Array<Record<string, string>> = [];
  for (const r of rows) {
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = r[j] ?? '';
    out.push(obj);
  }
  return out;
}

async function loadCsvIfAvailable(): Promise<void> {
  if (csvCache !== null) return; // already attempted
  if (!HTS_CSV_URL) {
    csvCache = [];
    return;
  }
  try {
    await client.warm();
    const csv = await client.getText(
      HTS_CSV_URL,
      'text/csv,application/octet-stream,text/plain,*/*'
    );
    const rows = parseCsv(csv);
    csvCache = rows as unknown as Record<string, unknown>[];
    if (DEBUG) console.log(`[HTS] CSV loaded: rows=${rows.length}`);
  } catch (e: any) {
    csvCache = [];
    if (DEBUG) console.warn('[HTS] CSV load failed:', e?.message || String(e));
  }
}

// ---------------- public: chapter export ----------------
/** Fetch one chapter as array of row objects. Uses CSV cache if present; otherwise HTS JSON (with retries). */
export async function exportChapterJson(chapter: number): Promise<Record<string, unknown>[]> {
  await loadCsvIfAvailable();
  const chapterPrefix = pad2(chapter);

  // 1) CSV path
  if (csvCache && csvCache.length) {
    const filtered = csvCache.filter((row) => {
      const code = parseHts10(row);
      return code ? code.slice(0, 2) === chapterPrefix : false;
    });
    if (DEBUG) console.log(`[HTS] ch${chapter} served from CSV: ${filtered.length} rows`);
    return filtered;
  }

  // 2) JSON path with retries
  await client.warm();

  const from = from4(chapter);
  const to = to4(chapter);
  const paths = [
    `/reststop/exportList?from=${from}&to=${to}&format=JSON&styles=false`,
    `/api/export?format=json&from=${from}&to=${to}&styles=false`,
  ];
  const MAX_TRIES = 4;

  for (const path of paths) {
    let attempt = 0;
    while (attempt < MAX_TRIES) {
      attempt++;
      try {
        const json = await client.getJson(path);
        const arr = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.rows)
              ? json.rows
              : null;

        if (Array.isArray(arr)) {
          if (DEBUG && attempt > 1) {
            console.warn(`[HTS] ch${chapter} succeeded on attempt ${attempt} via ${path}`);
          }
          return arr as Record<string, unknown>[];
        }
        throw new Error('Unexpected JSON shape');
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const looksLikeHtml = /<!DOCTYPE html/i.test(msg) || /Unexpected token</i.test(msg);
        if (looksLikeHtml) {
          if (DEBUG) console.warn(`[HTS] ch${chapter} got HTML; re-warming and retrying`);
          await client.warm();
        }
        if (attempt >= MAX_TRIES) {
          if (DEBUG)
            console.warn(`[HTS] ch${chapter} ${path} failed after ${attempt} tries: ${msg}`);
          break;
        }
        await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 250)));
      }
    }
  }

  if (DEBUG) console.warn(`[HTS] ch${chapter} gave no rows after retries`);
  return [];
}

// ---------------- field parsers (CSV+JSON) ----------------

/** Extract HTS10 from a row. Accepts 8+2 or raw 10; also accepts "number" variants. */
export function parseHts10(row: Record<string, unknown>): string | null {
  const baseKey =
    pickKey(row, [
      'heading/subheading',
      'headingsubheading',
      'htsno',
      'hts number',
      'hts',
      'number',
    ]) ??
    pickKey(row, ['goods_nomenclature_item_id', 'goodsnomenclatureitemid']) ??
    pickKey(row, ['heading', 'subheading']); // some CSVs have split labels in one column title
  let digits = baseKey ? String(row[baseKey] ?? '') : '';

  if (!digits) {
    const deep = deepPickValue(row, [
      'heading/subheading',
      'headingsubheading',
      'htsno',
      'number',
      'hts number',
      'goods_nomenclature_item_id',
    ]);
    if (deep) digits = deep;
  }

  digits = digits.replace(/\D+/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);

  const statKey =
    pickKey(row, ['stat suffix', 'statistical suffix', 'stat']) ??
    pickKey(row, ['statisticalindicator', 'statistical']);
  let stat = statKey ? String(row[statKey] ?? '') : '';
  if (!stat) {
    stat = deepPickValue(row, ['stat suffix', 'statistical suffix', 'stat', 'statistical']) ?? '';
  }
  stat = stat.replace(/\D+/g, '').padStart(2, '0');

  if (digits.length === 8 && stat.length === 2) return digits + stat;
  if (digits.length === 8) return digits + '00';

  return null;
}

/** Pull "General" (Column 1 – General) text from a row, searching flat and nested shapes. */
export function getGeneralCell(row: Record<string, unknown>): string | null {
  // direct CSV headers
  const k1 = pickKey(row, ['general', 'column 1 general', 'column1 general', 'general rate'], {
    requireString: true,
  });
  if (k1) return String(row[k1]);
  // nested JSON fallbacks
  const nested = deepPickValue(
    row,
    ['general', 'column1general', 'column 1 general', 'generalrate', 'rates of duty', 'duty'],
    (v) => typeof v === 'string' && /%|free/i.test(v)
  );
  return nested;
}

/** Pull "Special" (Column 1 – Special) text from a row, searching flat and nested shapes. */
export function getSpecialCell(row: Record<string, unknown>): string | null {
  const k1 = pickKey(row, ['special', 'column 1 special', 'column1 special', 'special rate'], {
    requireString: true,
  });
  if (k1) return String(row[k1]);
  const nested = deepPickValue(
    row,
    ['special', 'column1special', 'column 1 special', 'specialrate', 'rates of duty', 'duty'],
    (v) => typeof v === 'string' && /%|free/i.test(v)
  );
  return nested;
}

/** Return first ad-valorem % found; “Free” -> 0; otherwise null. */
export function parseAdValoremPercent(cell: string | null | undefined): number | null {
  if (!cell) return null;
  const s = cell.replace(/\s+/g, ' ').trim();
  if (/^free\b/i.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Heuristic: detect compound/specific components inside a rate cell. */
export function hasCompound(cell: string | null | undefined): boolean {
  if (!cell) return false;
  const s = cell.toLowerCase();
  return /(usd|eur|gbp|\$|per\s|\/\s*(kg|g|l|m|item|pair|t|hl)|\bkg\b|\bg\b|\bl\b|\bm\b|\+|\bmin\b|\bmax\b)/i.test(
    s
  );
}

/** numeric(6,3) as string. Avoids "-0.000". */
export function toNumeric3String(n: number): string {
  const s = Number(n).toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}
