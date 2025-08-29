import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { cell, headerIndex, iterateCsvRecords } from '../../../../duty-rates/utils/stream-csv.js';
import {
  DATASET_ID,
  getLatestVersionId,
  UK_10_DATA_API_BASE,
} from '../../../../duty-rates/services/uk/base.js';

export type ImportUk10AliasesResult = {
  ok: true;
  count: number;
  inserted: number;
  updated: number;
};

const TITLE_MAX = Number(process.env.HS_ALIAS_TITLE_MAX ?? 255);
const VERSION_OVERRIDE = process.env.UK_TARIFF_VERSION_ID || '';
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

// -------------- helpers --------------
const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const isUk10 = (s: string) => /^\d{10}$/.test(s);
const hs2n = (code10: string) => parseInt(code10.slice(0, 2), 10);
const hs4 = (code10: string) => code10.slice(0, 4);
const hs6 = (code10: string) => code10.slice(0, 6);
const clampTitle = (s: string) => {
  const t = (s || '—').replace(/\s+/g, ' ').trim();
  return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 1) + '…' : t;
};

function compose10(itemRaw: string, statRaw: string, defaultStatIfMissing = true): string | null {
  const item = onlyDigits(itemRaw);
  const stat = onlyDigits(statRaw);
  if (item.length >= 10) return item.slice(0, 10);
  if (item.length === 8) {
    if (stat.length === 2) return item + stat;
    if (defaultStatIfMissing) return item + '00';
  }
  return null;
}

async function httpJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${url} failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as T;
}

async function fetchCsvStream(
  versionId: string,
  table: string
): Promise<ReadableStream<Uint8Array> | null> {
  const url = `${UK_10_DATA_API_BASE}/v1/datasets/${DATASET_ID}/versions/${versionId}/tables/${table}/data?format=csv`;
  const res = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (res.status === 404) {
    if (DEBUG) console.warn(`[UK] table 404: ${table} ${url}`);
    return null;
  }
  if (!res.ok) throw new Error(`${url} failed: ${res.status} ${await res.text()}`);
  if (!res.body) throw new Error(`${table} CSV: empty body`);
  if (DEBUG) console.log('[UK] Streaming from', url);
  return res.body;
}

type TableInfo = { name: string; columns: string[] };

async function listTables(versionId: string): Promise<TableInfo[]> {
  const url = `${UK_10_DATA_API_BASE}/v1/datasets/${DATASET_ID}/versions/${versionId}/tables?format=json`;
  try {
    const j = await httpJson<any>(url);
    if (Array.isArray(j)) {
      return j.map((t: any) => ({
        name: String(t.name ?? t.table ?? t.id ?? ''),
        columns: Array.isArray(t.columns)
          ? t.columns.map((c: any) => String(c.name ?? c ?? '')).filter(Boolean)
          : [],
      }));
    }
    if (j && Array.isArray(j.tables)) {
      return j.tables.map((t: any) => ({
        name: String(t.name ?? t.table ?? t.id ?? ''),
        columns: Array.isArray(t.columns)
          ? t.columns.map((c: any) => String(c.name ?? c ?? '')).filter(Boolean)
          : [],
      }));
    }
  } catch (e) {
    if (DEBUG) console.warn('[UK] listTables failed; using known guesses:', (e as Error).message);
  }
  return [
    { name: 'commodities-report', columns: [] },
    { name: 'commodities', columns: [] },
    { name: 'declarable_commodities', columns: [] },
    { name: 'goods_nomenclatures', columns: [] },
    { name: 'goods_nomenclature_descriptions', columns: [] },
    { name: 'goods_nomenclature_description_periods', columns: [] },
    { name: 'commodity-descriptions', columns: [] },
  ];
}

// ---- header matching (robust) ----
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-]+/g, '')
    .replace(/__+/g, '_')
    .trim();

function idxFromHeaderMap(hdr: Map<string, number>, candidates: string[], patterns: RegExp[] = []) {
  const entries = Array.from(hdr.entries());
  const byNorm = new Map(entries.map(([k, v]) => [norm(k), v]));
  for (const cand of candidates) {
    const v = byNorm.get(norm(cand));
    if (typeof v === 'number') return v;
  }
  if (patterns.length) {
    for (const [k, v] of entries) {
      const lk = k.toLowerCase();
      if (patterns.some((rx) => rx.test(lk))) return v;
    }
  }
  return -1;
}

// ---- fast path: commodities-report (has code + description + suffix) ----
async function loadRowsFromReport(
  versionId: string
): Promise<Array<{ code: string; title: string }>> {
  const stream = await fetchCsvStream(versionId, 'commodities-report');
  if (!stream) return [];

  let isHeader = true;
  let iCode = -1,
    iDesc = -1,
    iDec = -1,
    iSuffix = -1;

  const out: Array<{ code: string; title: string }> = [];
  const seen = new Set<string>();
  let rows = 0,
    kept = 0,
    nonLeaf = 0,
    bad = 0;

  for await (const rec of iterateCsvRecords(stream)) {
    if (isHeader) {
      const { map } = headerIndex(rec);
      if (DEBUG) console.log('[UK] commodities-report header:', Array.from(map.keys()));

      // code/description columns
      iCode = idxFromHeaderMap(
        map,
        ['commodity__code', 'commodity_code', 'code'],
        [/^commodity.*code$/]
      );
      iDesc = idxFromHeaderMap(
        map,
        ['commodity__description', 'commodity_description', 'description'],
        [/^commodity.*description$/]
      );

      // leaf detection
      iDec = idxFromHeaderMap(map, ['declarable', 'is_declarable'], [/declarable/]);
      iSuffix = idxFromHeaderMap(
        map,
        ['commodity__suffix', 'suffix', 'productline_suffix'],
        [/suffix$/]
      );

      if (iCode === -1 || iDesc === -1) {
        if (DEBUG) console.warn('[UK] commodities-report: missing code/description columns');
        return [];
      }
      isHeader = false;
      continue;
    }

    rows++;

    let code = onlyDigits(cell(rec, iCode) || '');
    if (code.length === 8) code = code + '00';
    if (code.length > 10) code = code.slice(0, 10);

    // leaf filter: prefer explicit declarable, else suffix==80
    let isLeaf = true;
    if (iDec !== -1) {
      const d = (cell(rec, iDec) || '').toLowerCase();
      isLeaf = d === 'true' || d === 't' || d === '1' || d === 'yes';
    } else if (iSuffix !== -1) {
      isLeaf = onlyDigits(cell(rec, iSuffix) || '') === '80';
    }
    if (!isLeaf) {
      nonLeaf++;
      continue;
    }

    if (!isUk10(code)) {
      bad++;
      continue;
    }
    if (seen.has(code)) continue;
    seen.add(code);

    const title = clampTitle(cell(rec, iDesc) || '—');
    out.push({ code, title });
    kept++;
  }

  if (DEBUG) {
    console.log(
      `[UK] commodities-report yielded ${out.length} rows (rows=${rows}, kept=${kept}, nonLeaf=${nonLeaf}, bad=${bad})`
    );
  }
  return out;
}

function pickCodeTable(tables: TableInfo[]): string[] {
  const names = tables.map((t) => t.name);
  const prefs = ['commodities', 'declarable_commodities', 'goods_nomenclatures'];
  return names.filter((n) => prefs.includes(n));
}
function pickDescTables(tables: TableInfo[]): string[] {
  const names = tables.map((t) => t.name);
  const prefs = [
    'goods_nomenclature_descriptions',
    'commodity-descriptions',
    'goods_nomenclature_description_periods',
  ];
  return names.filter((n) => prefs.includes(n));
}

// ---- fallback: sid -> code from code tables ----
async function loadSidToCode(
  versionId: string,
  candidates: string[]
): Promise<Map<string, string>> {
  for (const table of candidates) {
    const stream = await fetchCsvStream(versionId, table);
    if (!stream) continue;

    let isHeader = true;
    let iSid = -1;
    let iCode = -1;
    let iItem = -1;
    let iStat = -1;
    let iSuffix = -1;
    let iDeclarable = -1;

    const m = new Map<string, string>();

    let rows = 0,
      kept = 0,
      filtered = 0,
      invalid = 0,
      seen8 = 0,
      seen10 = 0,
      composed = 0;

    for await (const rec of iterateCsvRecords(stream)) {
      if (isHeader) {
        const { map } = headerIndex(rec);
        if (DEBUG) console.log(`[UK] ${table} header:`, Array.from(map.keys()));

        iSid = idxFromHeaderMap(map, ['goods_nomenclature_sid', 'sid'], [/sid$/]);

        iCode = idxFromHeaderMap(
          map,
          ['commodity__code', 'commodity_code', 'code'],
          [/^commodity.*code$/]
        );

        iItem = idxFromHeaderMap(
          map,
          ['goods_nomenclature__item__id', 'goods_nomenclature_item_id', 'item_id'],
          [/item.*id$/]
        );
        iStat = idxFromHeaderMap(map, ['statistical', 'statistical_indicator'], [/statistical/]);

        iDeclarable = idxFromHeaderMap(map, ['declarable', 'is_declarable'], [/declarable/]);
        iSuffix = idxFromHeaderMap(map, ['suffix', 'productline_suffix'], [/suffix$/]);

        isHeader = false;
        continue;
      }

      rows++;
      const sid = (cell(rec, iSid) || '').trim();
      if (!sid) continue;

      // leaf check
      let isLeaf = true;
      if (iDeclarable !== -1) {
        const d = (cell(rec, iDeclarable) || '').toLowerCase();
        isLeaf = d === 'true' || d === 't' || d === '1' || d === 'yes';
      } else if (iSuffix !== -1) {
        isLeaf = onlyDigits(cell(rec, iSuffix) || '') === '80';
      }
      if (!isLeaf) {
        filtered++;
        continue;
      }

      let code: string | null = null;

      if (iCode !== -1) {
        const raw = onlyDigits(cell(rec, iCode) || '');
        code = raw.length >= 10 ? raw.slice(0, 10) : raw.length === 8 ? raw + '00' : null;
      } else if (iItem !== -1) {
        const rawItem = cell(rec, iItem) || '';
        const rawStat = iStat !== -1 ? cell(rec, iStat) || '' : '';
        const c = compose10(rawItem, rawStat, true);
        code = c;
        const itemDigits = onlyDigits(rawItem);
        const statDigits = onlyDigits(rawStat);
        if (itemDigits.length === 8 && statDigits.length === 2) composed++;
        if (itemDigits.length === 8 && statDigits.length !== 2) seen8++;
        if (itemDigits.length >= 10) seen10++;
      }

      if (code && isUk10(code)) {
        m.set(sid, code);
        kept++;
      } else {
        invalid++;
      }
    }

    if (m.size) {
      if (DEBUG) {
        console.log(
          `[UK] ${table} produced ${m.size} codes (rows=${rows}, kept=${kept}, filtered=${filtered}, invalid=${invalid}, seen8=${seen8}, seen10=${seen10}, composed=${composed})`
        );
      }
      return m;
    } else if (DEBUG) {
      console.warn(
        `[UK] ${table} produced 0 codes (rows=${rows}, filtered=${filtered}, invalid=${invalid})`
      );
    }
  }

  return new Map();
}

// ---- fallback: sid -> title from description tables ----
async function loadSidToTitle(
  versionId: string,
  candidates: string[]
): Promise<Map<string, string>> {
  for (const table of candidates) {
    const stream = await fetchCsvStream(versionId, table);
    if (!stream) continue;

    const map = new Map<string, string>();
    let isHeader = true;
    let iSid = -1,
      iDesc = -1,
      iLang = -1;

    for await (const rec of iterateCsvRecords(stream)) {
      if (isHeader) {
        const { map: hdr } = headerIndex(rec);
        if (DEBUG) console.log(`[UK] ${table} header:`, Array.from(hdr.keys()));
        iSid = idxFromHeaderMap(
          hdr,
          ['goods_nomenclature_sid', 'sid', 'goods_nomenclature__sid'],
          [/sid$/]
        );
        iDesc = idxFromHeaderMap(
          hdr,
          ['description', 'goods_nomenclature__description', 'commodity__description'],
          [/description$/]
        );
        iLang = idxFromHeaderMap(hdr, ['language_id', 'language'], [/language/]);
        isHeader = false;
        continue;
      }
      const sid = (cell(rec, iSid) || '').trim();
      if (!sid) continue;

      if (iLang !== -1) {
        const lang = (cell(rec, iLang) || '').toLowerCase();
        if (lang && lang !== 'en' && lang !== 'eng' && lang !== 'english') continue;
      }

      const desc = clampTitle(cell(rec, iDesc) || '');
      if (desc) map.set(sid, desc);
    }

    if (map.size) return map;
  }
  return new Map();
}

// -------------- importer --------------
export async function importUk10Aliases(): Promise<ImportUk10AliasesResult> {
  // FK guard: HS6 keys
  const hs6Rows = await db.select({ hs6: hsCodesTable.hs6 }).from(hsCodesTable);
  const VALID_HS6 = new Set(hs6Rows.map((r) => r.hs6));
  if (DEBUG) console.log(`[UK] Loaded ${VALID_HS6.size} HS6 from hs_codes`);

  const versionId = VERSION_OVERRIDE || (await getLatestVersionId());
  if (DEBUG) {
    console.log(
      VERSION_OVERRIDE
        ? `[UK] Using pinned dataset version: ${versionId}`
        : `[UK] Using latest dataset version: ${versionId}`
    );
  }

  const tables = await listTables(versionId);
  if (DEBUG)
    console.log(
      '[UK] Tables discovered:',
      tables.map((t) => t.name)
    );

  // 1) Fast path: commodities-report (code + description + suffix)
  const reportRows = await loadRowsFromReport(versionId);
  if (reportRows.length) {
    let inserted = 0,
      updated = 0,
      truncated = 0,
      skippedMissing = 0;

    const BATCH_SIZE = 500;
    const buffer: Array<{
      hs6: string;
      system: 'UK10';
      code: string;
      title: string;
      chapter: number;
      heading4: string;
    }> = [];

    const pushRow = (code: string, titleRaw: string) => {
      const title = clampTitle(titleRaw);
      if (title.endsWith('…')) truncated++;
      const h6 = hs6(code);

      // --- NEW GUARD: drop chapter/heading placeholders like 010000, 020000, etc.
      if (h6.slice(2, 4) === '00') {
        if (DEBUG) console.warn(`[UK] Drop placeholder hs6=${h6} (code=${code})`);
        return;
      }

      if (!VALID_HS6.has(h6)) {
        skippedMissing++;
        if (DEBUG && skippedMissing <= 20) {
          console.warn(`[UK] Skip: missing hs6=${h6} (code=${code}) title="${title}"`);
        }
        return;
      }
      buffer.push({
        hs6: h6,
        system: 'UK10',
        code,
        title,
        chapter: hs2n(code),
        heading4: hs4(code),
      });
    };

    for (const { code, title } of reportRows) {
      if (isUk10(code)) pushRow(code, title);
      if (buffer.length >= BATCH_SIZE) {
        const ret = await db
          .insert(hsCodeAliasesTable)
          .values(buffer)
          .onConflictDoUpdate({
            target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
            set: { title: sql`excluded.title`, updatedAt: sql`now()` },
            setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
          })
          .returning({ inserted: sql<number>`(xmax = 0)::int` });
        for (const r of ret) r.inserted === 1 ? inserted++ : updated++;
        if (DEBUG) console.log(`[UK] Bulk ok: +${ret.length} (ins=${inserted}, upd=${updated})`);
        buffer.length = 0;
      }
    }

    if (buffer.length) {
      const ret = await db
        .insert(hsCodeAliasesTable)
        .values(buffer)
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: { title: sql`excluded.title`, updatedAt: sql`now()` },
          setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
        })
        .returning({ inserted: sql<number>`(xmax = 0)::int` });
      for (const r of ret) r.inserted === 1 ? inserted++ : updated++;
      if (DEBUG) console.log(`[UK] Bulk ok: +${ret.length} (ins=${inserted}, upd=${updated})`);
    }

    if (DEBUG) {
      console.log(
        `[UK] Summary: inserted=${inserted}, updated=${updated}, skipped_missing_hs6=${skippedMissing}, truncated_titles=${truncated}, unique_codes=${reportRows.length}`
      );
    }
    return { ok: true as const, count: inserted + updated, inserted, updated };
  }

  // 2) Fallback: sid/code + description tables
  const codeCandidates = pickCodeTable(tables);
  const sidToCode = await loadSidToCode(versionId, codeCandidates);
  if (!sidToCode.size) {
    throw new Error(
      '[UK] No 10-digit codes found in commodities/goods_nomenclatures (or alternates)'
    );
  }

  const descCandidates = pickDescTables(tables);
  const sidToTitle = await loadSidToTitle(versionId, descCandidates);
  if (!sidToTitle.size && DEBUG) {
    console.warn('[UK] No titles found in descriptions tables; inserting with "—"');
  }

  let inserted = 0,
    updated = 0,
    truncated = 0,
    skippedMissing = 0;

  const BATCH_SIZE = 500;
  const buffer: Array<{
    hs6: string;
    system: 'UK10';
    code: string;
    title: string;
    chapter: number;
    heading4: string;
  }> = [];

  const pushRow = (code: string, titleRaw: string) => {
    const title = clampTitle(titleRaw);
    if (title.endsWith('…')) truncated++;
    const h6 = hs6(code);

    // --- NEW GUARD: drop chapter/heading placeholders like 010000, 020000, etc.
    if (h6.slice(2, 4) === '00') {
      if (DEBUG) console.warn(`[UK] Drop placeholder hs6=${h6} (code=${code})`);
      return;
    }

    if (!VALID_HS6.has(h6)) {
      skippedMissing++;
      if (DEBUG && skippedMissing <= 20) {
        console.warn(`[UK] Skip: missing hs6=${h6} (code=${code}) title="${title}"`);
      }
      return;
    }
    buffer.push({
      hs6: h6,
      system: 'UK10',
      code,
      title,
      chapter: hs2n(code),
      heading4: hs4(code),
    });
  };

  for (const [sid, code] of sidToCode) {
    const title = sidToTitle.get(sid) ?? '—';
    if (isUk10(code)) pushRow(code, title);
    if (buffer.length >= BATCH_SIZE) {
      const ret = await db
        .insert(hsCodeAliasesTable)
        .values(buffer)
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: { title: sql`excluded.title`, updatedAt: sql`now()` },
          setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
        })
        .returning({ inserted: sql<number>`(xmax = 0)::int` });
      for (const r of ret) r.inserted === 1 ? inserted++ : updated++;
      if (DEBUG) console.log(`[UK] Bulk ok: +${ret.length} (ins=${inserted}, upd=${updated})`);
      buffer.length = 0;
    }
  }

  if (buffer.length) {
    const ret = await db
      .insert(hsCodeAliasesTable)
      .values(buffer)
      .onConflictDoUpdate({
        target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
        set: { title: sql`excluded.title`, updatedAt: sql`now()` },
        setWhere: sql`${hsCodeAliasesTable.title} is distinct from excluded.title`,
      })
      .returning({ inserted: sql<number>`(xmax = 0)::int` });
    for (const r of ret) r.inserted === 1 ? inserted++ : updated++;
    if (DEBUG) console.log(`[UK] Bulk ok: +${ret.length} (ins=${inserted}, upd=${updated})`);
  }

  if (DEBUG) {
    console.log(
      `[UK] Summary: inserted=${inserted}, updated=${updated}, skipped_missing_hs6=${skippedMissing}, truncated_titles=${truncated}, unique_codes=${sidToCode.size}`
    );
  }

  return { ok: true as const, count: inserted + updated, inserted, updated };
}
