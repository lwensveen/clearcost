// Import EU CN8 + TARIC10 aliases from TARIC goods nomenclature + descriptions.
// - CN8 = goods_nomenclature_item_id (8 digits).
// - TARIC10 = CN8 + producline_suffix (2 digits) when suffix is numeric (e.g., '80').
// - Title is taken from GOODS_NOMENCLATURE_DESCRIPTION (language=EN by default).
// - Validity: keep items active on the provided date (default: today UTC).
//
// Upsert semantics: (system, code) unique → update { hs6, title, updatedAt } on conflict.

import { db, hsCodeAliasesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { activeOn, code10, hs6, loadTaricBundle } from './taric-shared.js';

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

export async function importEuAliasesFromTaric(opts: ImportOpts = {}) {
  const goodsUrl = opts.xmlGoodsUrl ?? process.env.EU_TARIC_GOODS_URL ?? '';
  const descUrl = opts.xmlDescUrl ?? process.env.EU_TARIC_GOODS_DESC_URL ?? '';
  const lang = (opts.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();
  const onYmd = todayUtcYmd(opts.activeOn ?? new Date());
  const addTaric10 = opts.includeTaric10 ?? true;

  if (!goodsUrl || !descUrl) {
    return { ok: true as const, count: 0, message: 'Missing EU_TARIC_GOODS*_URL envs' };
  }

  // One-shot fetch + parse (cached by loadTaricBundle)
  const { goods, descs } = await loadTaricBundle({ goodsUrl, descUrl, lang });

  const cn8Rows: Array<{ code: string; hs6: string; title: string }> = [];
  const t10Rows: Array<{ code: string; hs6: string; title: string }> = [];

  for (const g of goods.values()) {
    if (!activeOn(onYmd, g.start, g.end)) continue;

    const baseHs6 = hs6(g.code8);
    if (!baseHs6) continue;

    const title = descs.get(g.sid) ?? '';
    if (!title) continue;

    // CN8
    if (g.code8.length === 8) {
      cn8Rows.push({ code: g.code8, hs6: baseHs6, title });
    }

    // TARIC10 (CN8 + 2-digit numeric producline_suffix)
    if (addTaric10) {
      const c10 = code10(g.code8, g.suffix);
      if (c10) t10Rows.push({ code: c10, hs6: baseHs6, title });
    }
  }

  const upserts = async (
    system: 'CN8' | 'TARIC10',
    rows: Array<{ code: string; hs6: string; title: string }>
  ) => {
    for (const r of rows) {
      await db
        .insert(hsCodeAliasesTable)
        .values({ system, code: r.code, hs6: r.hs6, title: r.title })
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: { hs6: r.hs6, title: r.title, updatedAt: sql`now()` },
        });
    }
  };

  let count = 0;
  await db.transaction(async () => {
    if (cn8Rows.length) {
      await upserts('CN8', cn8Rows);
      count += cn8Rows.length;
    }
    if (t10Rows.length) {
      await upserts('TARIC10', t10Rows);
      count += t10Rows.length;
    }
  });

  return { ok: true as const, count };
}
