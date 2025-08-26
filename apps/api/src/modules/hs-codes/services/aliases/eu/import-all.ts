import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { activeOn, code10, hs6, loadTaricBundle } from './taric-shared.js';

export async function importEuHs6AndAliases(
  opts: {
    goodsUrl?: string;
    descUrl?: string;
    lang?: string;
    on?: Date;
    includeTaric10?: boolean;
  } = {}
) {
  const goodsUrl = opts.goodsUrl ?? process.env.EU_TARIC_GOODS_URL ?? '';
  const descUrl = opts.descUrl ?? process.env.EU_TARIC_GOODS_DESC_URL ?? '';
  const lang = (opts.lang ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();
  const ymd = (opts.on ?? new Date()).toISOString().slice(0, 10);
  const addT10 = opts.includeTaric10 ?? true;

  const { goods, descs } = await loadTaricBundle({ goodsUrl, descUrl, lang });

  const hs6Title = new Map<string, string>();
  const cn8Rows: Array<{ sys: 'CN8' | 'TARIC10'; code: string; hs6: string; title: string }> = [];

  for (const g of goods.values()) {
    if (!activeOn(ymd, g.start, g.end)) continue;
    const code6 = hs6(g.code8);
    if (!code6) continue;
    const title = descs.get(g.sid) ?? '';
    if (!title) continue;

    // best HS6 title
    const prev = hs6Title.get(code6);
    if (!prev || title.length < prev.length) hs6Title.set(code6, title);

    // CN8
    if (g.code8.length === 8) cn8Rows.push({ sys: 'CN8', code: g.code8, hs6: code6, title });
    // TARIC10
    if (addT10) {
      const c10 = code10(g.code8, g.suffix);
      if (c10) cn8Rows.push({ sys: 'TARIC10', code: c10, hs6: code6, title });
    }
  }

  // single txn
  let hs6Count = 0,
    aliasCount = 0;
  await db.transaction(async (trx) => {
    for (const [code6, title] of hs6Title) {
      await trx
        .insert(hsCodesTable)
        .values({ hs6: code6, title })
        .onConflictDoUpdate({
          target: hsCodesTable.hs6,
          set: { title, updatedAt: sql`now()` },
        });
      hs6Count++;
    }

    for (const r of cn8Rows) {
      await trx
        .insert(hsCodeAliasesTable)
        .values({ system: r.sys, code: r.code, hs6: r.hs6, title: r.title })
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: { hs6: r.hs6, title: r.title, updatedAt: sql`now()` },
        });
      aliasCount++;
    }
  });

  return { ok: true as const, hs6Inserted: hs6Count, aliasInserted: aliasCount };
}
