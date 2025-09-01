import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { UsitcClient } from '../../../../duty-rates/services/us/usitc-client.js';

export type ImportUsHts10AliasesResult = {
  ok: true;
  count: number;
  inserted: number;
  updated: number;
};

const HTS_BASE = process.env.HTS_API_BASE ?? 'https://hts.usitc.gov';
const HTS_JSON_URL = process.env.HTS_JSON_URL;
const HTS_CSV_URL = process.env.HTS_CSV_URL;
const TITLE_MAX = Number(process.env.HS_ALIAS_TITLE_MAX ?? 255);
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

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

// ---------- Field helpers ----------
function normKey(s: string) {
  return s
    .toLowerCase()
    .replace(/[\s_]+/g, '')
    .trim();
}
function pickKey(row: Record<string, unknown>, cands: string[]) {
  for (const k of Object.keys(row))
    if (cands.some((c) => normKey(k).includes(normKey(c)))) return k;
  return null;
}
function parseHts10(row: Record<string, unknown>): string | null {
  const hKey = pickKey(row, [
    'heading/subheading',
    'headingsubheading',
    'htsno',
    'hts number',
    'hts',
  ]);
  if (!hKey) return null;
  const digits = String(row[hKey] ?? '').replace(/\D+/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  const statKey = pickKey(row, ['stat suffix', 'statistical suffix', 'stat']);
  const stat = statKey
    ? String(row[statKey] ?? '')
        .replace(/\D+/g, '')
        .padStart(2, '0')
    : '';
  if (digits.length === 8 && stat.length === 2) return digits + stat;
  if (digits.length === 8) return digits + '00';
  return null;
}
function parseTitle(row: Record<string, unknown>): string {
  const dKey = pickKey(row, ['article description', 'description', 'article', 'desc']);
  const s = dKey ? String(row[dKey] ?? '').trim() : '';
  const cleaned = (s || '—').replace(/\s+/g, ' ').trim();
  return cleaned.length > TITLE_MAX ? cleaned.slice(0, TITLE_MAX - 1) + '…' : cleaned;
}
const chapterOf = (code10: string) => parseInt(code10.slice(0, 2), 10);
const heading4Of = (code10: string) => code10.slice(0, 4);
const hs6Of = (code10: string) => code10.slice(0, 6);

// ---------- Fetchers (via client) ----------
const client = new UsitcClient(HTS_BASE);

async function fetchAllRowsViaCSV(): Promise<Record<string, unknown>[]> {
  if (!HTS_CSV_URL) return [];
  const csv = await client.getText(HTS_CSV_URL, 'text/csv,application/octet-stream,text/plain,*/*');
  return parseCsv(csv) as Record<string, unknown>[];
}
async function fetchAllRowsViaJSON(): Promise<Record<string, unknown>[]> {
  if (!HTS_JSON_URL) return [];
  const json = await client.getJson(HTS_JSON_URL);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.rows)) return json.rows;
  return [];
}

// ---------- REST per chapter ----------
function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function from4(ch: number) {
  return `${pad2(ch)}01`;
}
function to4(ch: number) {
  return `${pad2(ch)}99`;
}

async function exportChapterJson(chapter: number): Promise<Record<string, unknown>[]> {
  const from = from4(chapter),
    to = to4(chapter);
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
        if (Array.isArray(arr)) return arr as Record<string, unknown>[];
        throw new Error('Unexpected shape');
      } catch (e) {
        const msg = (e as Error).message || String(e);
        if (attempt >= MAX_TRIES) {
          console.warn(`HTS ch${chapter} ${path} failed: ${msg}`);
          break;
        }
        if (/Failed to parse JSON: <!?DOCTYPE html/i.test(msg)) await client.warm();
        await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));
      }
    }
  }
  return [];
}
async function fetchAllRowsViaRest(): Promise<Record<string, unknown>[]> {
  const chapters = Array.from({ length: 97 }, (_, i) => i + 1);
  const CONCURRENCY = 4;
  const out: Record<string, unknown>[][] = [];
  let idx = 0;
  async function worker() {
    while (idx < chapters.length) {
      const ch = chapters[idx++]!;
      const rows = await exportChapterJson(ch);
      if (rows.length === 0 && ch !== 77) console.warn(`HTS ch${ch} returned 0 rows`);
      out.push(rows);
      await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 120)));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out.flat();
}

// ---------- Importer ----------
export async function importUsHts10Aliases(): Promise<ImportUsHts10AliasesResult> {
  await client.warm();

  // Load authoritative HS6 keys (used only for normal chapters 01–97)
  const hs6Rows = await db.select({ hs6: hsCodesTable.hs6 }).from(hsCodesTable);
  const VALID_HS6 = new Set(hs6Rows.map((r) => r.hs6));
  if (DEBUG) console.log(`[HTS] Loaded ${VALID_HS6.size} HS6 from hs_codes`);

  let rows: Record<string, unknown>[] = [];
  try {
    if (!rows.length && HTS_CSV_URL) {
      rows = await fetchAllRowsViaCSV();
      if (rows.length) console.log(`HTS: CSV rows=${rows.length}`);
    }
  } catch (e) {
    console.warn('HTS: CSV failed:', (e as Error).message);
  }
  try {
    if (!rows.length && HTS_JSON_URL) {
      rows = await fetchAllRowsViaJSON();
      if (rows.length) console.log(`HTS: JSON rows=${rows.length}`);
    }
  } catch (e) {
    console.warn('HTS: JSON failed:', (e as Error).message);
  }
  if (!rows.length) {
    console.warn('HTS: falling back to REST per chapter');
    rows = await fetchAllRowsViaRest();
  }
  if (!rows.length) {
    console.warn('HTS: no rows from any source');
    return { ok: true as const, count: 0, inserted: 0, updated: 0 };
  }

  let inserted = 0,
    updated = 0;
  const BATCH_SIZE = 500;

  type AliasInsert = {
    hs6: string | null;
    system: 'HTS10';
    code: string;
    title: string;
    chapter: number;
    heading4: string;
    isSpecial: boolean;
  };

  const buffer: AliasInsert[] = [];
  let skippedMissingHs6 = 0;
  let truncatedTitles = 0;
  let insertedSpecial = 0;

  const bulkFlush = async () => {
    if (!buffer.length) return;

    try {
      const ret = await db
        .insert(hsCodeAliasesTable)
        .values(buffer)
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: { title: sql`excluded.title`, updatedAt: sql`now()` },
          setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
        })
        .returning({ inserted: sql<number>`(xmax = 0)::int` });

      let localIns = 0,
        localUpd = 0;
      for (const r of ret) r.inserted === 1 ? localIns++ : localUpd++;
      inserted += localIns;
      updated += localUpd;
      if (DEBUG) console.log(`[HTS] Bulk ok: +${buffer.length} (ins=${inserted}, upd=${updated})`);
    } catch (err) {
      const emsg = (err as Error).message || String(err);
      console.warn('Bulk upsert failed, falling back to per-row. Reason:', emsg);

      for (const row of buffer) {
        try {
          const ret = await db
            .insert(hsCodeAliasesTable)
            .values(row)
            .onConflictDoUpdate({
              target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
              set: { title: sql`excluded.title`, updatedAt: sql`now()` },
              setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
            })
            .returning({ inserted: sql<number>`(xmax = 0)::int` });
          const r = ret?.[0];
          if (r?.inserted === 1) inserted++;
          else updated++;
        } catch (e) {
          // If this blows up, log and skip; usually indicates schema mismatch (hs6 NOT NULL) or FK issue.
          if (DEBUG) {
            console.warn(
              `[HTS] Per-row failed code=${row.code} hs6=${row.hs6} chap=${row.chapter}`,
              (e as Error).message
            );
          }
        }
      }
    } finally {
      buffer.length = 0;
    }
  };

  for (const row of rows) {
    const code10 = parseHts10(row);
    if (!code10) continue;

    const chapter = chapterOf(code10);
    const heading4 = heading4Of(code10);
    const h6 = hs6Of(code10);
    const isSpecial = chapter >= 98;

    const rawTitle = parseTitle(row);
    if (rawTitle.length >= TITLE_MAX) truncatedTitles++;

    // Only attach hs6 for normal chapters 01–97 *and* when present in hs_codes.
    const hs6Value = !isSpecial && VALID_HS6.has(h6) ? h6 : null;
    if (!isSpecial && hs6Value === null) {
      skippedMissingHs6++;
      if (DEBUG && skippedMissingHs6 <= 20) {
        console.warn(`[HTS] Skip: missing hs6=${h6} (code=${code10}) title="${rawTitle}"`);
      }
      continue;
    }
    if (isSpecial) insertedSpecial++;

    buffer.push({
      hs6: hs6Value,
      system: 'HTS10',
      code: code10,
      title: rawTitle,
      chapter,
      heading4,
      isSpecial,
    });

    if (buffer.length >= BATCH_SIZE) await bulkFlush();
  }
  await bulkFlush();

  if (DEBUG) {
    console.log(
      `[HTS] Summary: input_rows=${rows.length}, inserted=${inserted}, updated=${updated}, ` +
        `skipped_missing_hs6=${skippedMissingHs6}, truncated_titles=${truncatedTitles}, special_inserted=${insertedSpecial}`
    );
  }

  return { ok: true as const, count: inserted + updated, inserted, updated };
}
