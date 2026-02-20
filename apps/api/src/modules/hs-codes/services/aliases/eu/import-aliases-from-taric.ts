// apps/api/src/modules/hs-codes/services/aliases/eu/import-aliases-from-taric.ts
// Import EU CN8 + TARIC10 aliases from TARIC goods nomenclature + descriptions.
// - CN8 = goods_nomenclature_item_id (8 digits).
// - TARIC10 = CN8 + producline_suffix (2 digits) when suffix is numeric (e.g., '80').
// - Title is taken from GOODS_NOMENCLATURE_DESCRIPTION (language=EN by default).
// - Validity: keep items active on the provided date (default: today UTC).
//
// Upsert semantics: (system, code) unique → update { hs6, title, updatedAt } on conflict.

import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { activeOn, code10, hs6 as hs6From8, loadTaricBundle } from './taric-shared.js';
import { resolveEuTaricHsSourceUrls } from './source-urls.js';

function todayUtcYmd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

type ImportOpts = {
  /** GOODS_NOMENCLATURE.xml(.gz) */
  xmlGoodsUrl?: string;
  /** GOODS_NOMENCLATURE_DESCRIPTION.xml(.gz) */
  xmlDescUrl?: string;
  /** Language code for descriptions, default 'EN' */
  language?: string;
  /** Keep items active on this date (UTC), default today */
  activeOn?: Date;
  /** Also emit TARIC10 aliases (default: true). CN8 is always emitted. */
  includeTaric10?: boolean;
};

const TITLE_MAX = Number(process.env.HS_ALIAS_TITLE_MAX ?? 255);
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const hs2n = (code: string) => parseInt(code.slice(0, 2), 10);
const hs4 = (code: string) => code.slice(0, 4);
const clampTitle = (s: string) => {
  const t = (s || '—').replace(/\s+/g, ' ').trim();
  return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 1) + '…' : t;
};

export async function importEuAliasesFromTaric(opts: ImportOpts = {}) {
  const { goodsUrl, descUrl } = await resolveEuTaricHsSourceUrls({
    goodsUrl: opts.xmlGoodsUrl,
    descUrl: opts.xmlDescUrl,
  });
  const lang = (opts.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();
  const onYmd = todayUtcYmd(opts.activeOn ?? new Date());
  const addTaric10 = opts.includeTaric10 ?? true;

  if (!goodsUrl || !descUrl) {
    return { ok: true as const, count: 0, inserted: 0, updated: 0 };
  }

  // FK guard: load valid HS6 once
  const hs6Rows = await db.select({ hs6: hsCodesTable.hs6 }).from(hsCodesTable);
  const VALID_HS6 = new Set(hs6Rows.map((r) => r.hs6));
  if (DEBUG) console.log(`[EU] Loaded ${VALID_HS6.size} HS6 from hs_codes`);

  // One-shot fetch + parse (cached by loadTaricBundle)
  const { goods, descs } = await loadTaricBundle({ goodsUrl, descUrl, lang });

  type Row = {
    hs6: string;
    system: 'CN8' | 'TARIC10';
    code: string;
    title: string;
    chapter: number;
    heading4: string;
  };

  const cn8Rows: Row[] = [];
  const t10Rows: Row[] = [];

  let skippedMissing = 0;
  let truncated = 0;

  for (const g of goods.values()) {
    if (!activeOn(onYmd, g.start, g.end)) continue;

    // Title (EN)
    const titleRaw = descs.get(g.sid) ?? '';
    if (!titleRaw) continue;
    const title = clampTitle(titleRaw);
    if (title.endsWith('…')) truncated++;

    // CN8
    const code8 = onlyDigits(g.code8).slice(0, 8);
    if (code8.length === 8) {
      const h6 = hs6From8(code8);
      if (!h6 || !VALID_HS6.has(h6)) {
        skippedMissing++;
        continue;
      }
      cn8Rows.push({
        hs6: h6,
        system: 'CN8',
        code: code8,
        title,
        chapter: hs2n(code8),
        heading4: hs4(code8),
      });
    }

    // TARIC10 (CN8 + numeric 2-digit suffix)
    if (addTaric10) {
      const c10 = code10(code8, g.suffix);
      if (c10) {
        const h6 = hs6From8(code8)!; // already 8 digits
        if (!VALID_HS6.has(h6)) {
          skippedMissing++;
          continue;
        }
        t10Rows.push({
          hs6: h6,
          system: 'TARIC10',
          code: c10,
          title,
          chapter: hs2n(c10),
          heading4: hs4(c10),
        });
      }
    }
  }

  // Batch upsert helper
  const BATCH_SIZE = 500;
  async function flush(rows: Row[]) {
    if (!rows.length) return { ins: 0, upd: 0 };
    const ret = await db
      .insert(hsCodeAliasesTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
        set: { hs6: sql`excluded.hs6`, title: sql`excluded.title`, updatedAt: sql`now()` },
      })
      .returning({ inserted: sql<number>`(xmax = 0)::int` });
    let ins = 0,
      upd = 0;
    for (const r of ret) r.inserted === 1 ? ins++ : upd++;
    return { ins, upd };
  }

  // Flush in chunks
  let inserted = 0,
    updated = 0;

  const buffers: Row[][] = [];
  const pushBuffered = async (row: Row) => {
    let buf = buffers[buffers.length - 1];
    if (!buf || buf.length >= BATCH_SIZE) {
      buf = [];
      buffers.push(buf);
    }
    buf.push(row);
    if (buf.length >= BATCH_SIZE) {
      const { ins, upd } = await flush(buf);
      inserted += ins;
      updated += upd;
      if (DEBUG) console.log(`[EU] Bulk ok: +${buf.length} (ins=${inserted}, upd=${updated})`);
      buf.length = 0;
    }
  };

  for (const r of cn8Rows) await pushBuffered(r);
  for (const r of t10Rows) await pushBuffered(r);

  // Final flush for any residual rows
  for (const buf of buffers) {
    if (buf.length) {
      const { ins, upd } = await flush(buf);
      inserted += ins;
      updated += upd;
      if (DEBUG) console.log(`[EU] Bulk ok: +${buf.length} (ins=${inserted}, upd=${updated})`);
      buf.length = 0;
    }
  }

  if (DEBUG) {
    console.log(
      `[EU] Summary: CN8=${cn8Rows.length}, TARIC10=${t10Rows.length}, inserted=${inserted}, updated=${updated}, skipped_missing_hs6=${skippedMissing}, truncated_titles=${truncated}`
    );
  }

  return { ok: true as const, count: inserted + updated, inserted, updated };
}
