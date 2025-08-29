import { db, hsCodeAliasesTable, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { activeOn, code10, hs6, loadTaricBundle } from './taric-shared.js';

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

const hs2n = (code: string) => parseInt(code.slice(0, 2), 10);
const hs4 = (code: string) => code.slice(0, 4);

type AliasRow = {
  system: 'CN8' | 'TARIC10';
  code: string; // 8 or 10 digits
  hs6: string; // 6 digits
  title: string;
  chapter: number; // first 2 digits as number
  heading4: string; // first 4 digits
};

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

  if (!goodsUrl || !descUrl) {
    if (DEBUG)
      console.warn('[EU] Missing TARIC URLs (EU_TARIC_GOODS_URL / EU_TARIC_GOODS_DESC_URL)');
    return { ok: true as const, hs6Inserted: 0, aliasInserted: 0 };
  }

  const { goods, descs } = await loadTaricBundle({ goodsUrl, descUrl, lang });

  const hs6Title = new Map<string, string>();
  const aliasRows: AliasRow[] = [];

  for (const g of goods.values()) {
    if (!activeOn(ymd, g.start, g.end)) continue;

    const code6 = hs6(g.code8);
    if (!code6) continue;

    const title = descs.get(g.sid) ?? '';
    if (!title) continue;

    // Prefer the shortest (usually most specific) HS6 title encountered
    const prev = hs6Title.get(code6);
    if (!prev || title.length < prev.length) hs6Title.set(code6, title);

    // CN8 alias
    if (g.code8.length === 8) {
      aliasRows.push({
        system: 'CN8',
        code: g.code8,
        hs6: code6,
        title,
        chapter: hs2n(g.code8),
        heading4: hs4(g.code8),
      });
    }

    // TARIC10 alias (CN8 + 2-digit numeric suffix)
    if (addT10) {
      const c10 = code10(g.code8, g.suffix);
      if (c10) {
        aliasRows.push({
          system: 'TARIC10',
          code: c10,
          hs6: code6,
          title,
          chapter: hs2n(c10),
          heading4: hs4(c10),
        });
      }
    }
  }

  let hs6Count = 0;
  let aliasCount = 0;

  await db.transaction(async (trx) => {
    // Upsert HS6 titles
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

    // Upsert CN8/TARIC10 aliases with chapter/heading4
    for (const r of aliasRows) {
      await trx
        .insert(hsCodeAliasesTable)
        .values({
          system: r.system,
          code: r.code,
          hs6: r.hs6,
          title: r.title,
          chapter: r.chapter,
          heading4: r.heading4,
        })
        .onConflictDoUpdate({
          target: [hsCodeAliasesTable.system, hsCodeAliasesTable.code],
          set: {
            hs6: r.hs6,
            title: r.title,
            chapter: r.chapter,
            heading4: r.heading4,
            updatedAt: sql`now()`,
          },
        });
      aliasCount++;
    }
  });

  if (DEBUG) {
    console.log('[EU] TARIC import summary', {
      hs6Inserted: hs6Count,
      aliasInserted: aliasCount,
      lang,
      addT10,
      on: ymd,
    });
  }

  return { ok: true as const, hs6Inserted: hs6Count, aliasInserted: aliasCount };
}
