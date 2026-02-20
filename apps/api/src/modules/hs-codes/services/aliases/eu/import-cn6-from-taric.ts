// Import EU HS6 titles from TARIC goods nomenclature.
// - Source: GOODS_NOMENCLATURE.xml(.gz) + GOODS_NOMENCLATURE_DESCRIPTION.xml(.gz)
// - Uses shared helpers (loadTaricBundle/activeOn/hs6) from taric-shared.ts
// - Filters to items active on the provided date (default: today UTC)
// - Upserts into hs_codes(hs6, title) and (optionally) records provenance

import { db, hsCodesTable, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { activeOn, hs6, loadTaricBundle } from './taric-shared.js';
import { sha256Hex } from '../../../../../lib/provenance.js';
import { resolveEuTaricHsSourceUrls } from './source-urls.js';

type ImportOpts = {
  /** GOODS_NOMENCLATURE.xml(.gz) */
  xmlGoodsUrl?: string;
  /** GOODS_NOMENCLATURE_DESCRIPTION.xml(.gz) */
  xmlDescUrl?: string;
  /** Description language, default 'EN' */
  language?: string;
  /** Keep items active on this UTC date, default today */
  activeOn?: Date;
  /** Optional provenance import id (threaded from route plugin) */
  importId?: string;
  /** Optional custom sourceRef builder for provenance */
  makeSourceRef?: (code6: string) => string | undefined;
};

function ymdUTC(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function importEuHs6FromTaric(opts: ImportOpts = {}) {
  const { goodsUrl, descUrl } = await resolveEuTaricHsSourceUrls({
    goodsUrl: opts.xmlGoodsUrl,
    descUrl: opts.xmlDescUrl,
  });
  const lang = (opts.language ?? process.env.EU_TARIC_LANGUAGE ?? 'EN').toUpperCase();
  const onYmd = ymdUTC(opts.activeOn ?? new Date());

  if (!goodsUrl || !descUrl) {
    return { ok: true as const, count: 0, message: 'Missing EU_TARIC_GOODS*_URL envs' };
  }

  // One-shot fetch + parse (cached by loadTaricBundle)
  const { goods, descs } = await loadTaricBundle({ goodsUrl, descUrl, lang });

  // Prefer the shortest title per HS6
  const titleByHs6 = new Map<string, string>();

  for (const g of goods.values()) {
    if (!activeOn(onYmd, g.start, g.end)) continue;

    const code6 = hs6(g.code8);
    if (!code6) continue;

    const title = descs.get(g.sid) ?? '';
    if (!title) continue;

    const prev = titleByHs6.get(code6);
    if (!prev || title.length < prev.length) titleByHs6.set(code6, title);
  }

  if (titleByHs6.size === 0) return { ok: true as const, count: 0 };

  const provRows: {
    importId: string;
    resourceType: 'hs_code';
    resourceId: string;
    sourceRef?: string;
    rowHash: string;
  }[] = [];

  let count = 0;
  await db.transaction(async (trx) => {
    for (const [code6, title] of titleByHs6) {
      const ret = await trx
        .insert(hsCodesTable)
        .values({ hs6: code6, title })
        .onConflictDoUpdate({
          target: hsCodesTable.hs6,
          set: { title, updatedAt: sql`now()` },
        })
        .returning({ id: hsCodesTable.id, hs6: hsCodesTable.hs6, title: hsCodesTable.title });

      const row = ret[0];
      if (row) {
        count += 1;
        if (opts.importId) {
          provRows.push({
            importId: opts.importId,
            resourceType: 'hs_code',
            resourceId: row.id,
            sourceRef: opts.makeSourceRef?.(row.hs6) ?? `taric:hs6:${row.hs6}`,
            rowHash: sha256Hex(JSON.stringify({ hs6: row.hs6, title: row.title })),
          });
        }
      }
    }

    if (provRows.length) {
      await trx.insert(provenanceTable).values(provRows);
    }
  });

  return { ok: true as const, count };
}
