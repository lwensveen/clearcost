export type GoodsRow = {
  sid: string;
  code8: string;
  suffix?: string | null;
  start?: string;
  end?: string | null;
};
export type DescMap = Map<string, string>;
export type GoodsMap = Map<string, GoodsRow>;

async function fetchXml(url: string) {
  const r = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} ${r.statusText}`);
  return r.text(); // rely on Content-Encoding: gzip
}

// very small tag-extractor (fast-enough for TARIC, matches inner text of simple nodes)
export function getTag(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1]!.trim() : null;
}

export function* splitOn(xml: string, element: string) {
  const open = `<${element}`,
    close = `</${element}>`;
  let i = 0;
  while (true) {
    const s = xml.indexOf(open, i);
    if (s < 0) break;
    const e = xml.indexOf(close, s);
    if (e < 0) break;
    const k = e + close.length;
    yield xml.slice(s, k);
    i = k;
  }
}
export function activeOn(ymd: string, start?: string, end?: string | null) {
  if (start && ymd < start) return false;
  if (end && ymd >= end) return false;
  return true;
}
export function hs6(code8: string): string | null {
  const s = (code8 || '').replace(/\D+/g, '').slice(0, 6);
  return s.length === 6 ? s : null;
}
export function code10(code8: string, suffix?: string | null) {
  const c8 = (code8 || '').replace(/\D+/g, '').slice(0, 8);
  const sx = (suffix || '').replace(/\D+/g, '').slice(0, 2);
  return c8.length === 8 && sx.length === 2 ? `${c8}${sx}` : null;
}

// --- parse + one-run cache -------------------------------------------
let cache: { key: string; goods: GoodsMap; descs: DescMap } | null = null;

export async function loadTaricBundle(opts: {
  goodsUrl: string;
  descUrl: string;
  lang: string;
}): Promise<{ goods: GoodsMap; descs: DescMap }> {
  const key = `${opts.goodsUrl}|${opts.descUrl}|${opts.lang.toUpperCase()}`;
  if (cache?.key === key) return { goods: cache.goods, descs: cache.descs };

  const [goodsXml, descXml] = await Promise.all([fetchXml(opts.goodsUrl), fetchXml(opts.descUrl)]);

  const goods: GoodsMap = new Map();
  for (const node of splitOn(goodsXml, 'goods_nomenclature')) {
    const sid = getTag(node, 'goods_nomenclature_sid');
    const code8 = getTag(node, 'goods_nomenclature_item_id');
    if (!sid || !code8) continue;
    goods.set(sid, {
      sid,
      code8: code8.replace(/\D+/g, '').slice(0, 8),
      suffix: getTag(node, 'producline_suffix'),
      start: getTag(node, 'validity_start_date') ?? undefined,
      end: getTag(node, 'validity_end_date'),
    });
  }

  const wantLang = opts.lang.toUpperCase();
  const descs: DescMap = new Map();
  for (const node of splitOn(descXml, 'goods_nomenclature_description')) {
    const sid = getTag(node, 'goods_nomenclature_sid');
    const lang = getTag(node, 'language_id')?.toUpperCase();
    if (!sid || lang !== wantLang) continue;
    const raw = getTag(node, 'description') ?? getTag(node, 'description_text') ?? '';
    const title = raw.replace(/\s+/g, ' ').trim();
    if (title) descs.set(sid, title);
  }

  cache = { key, goods, descs };
  return { goods, descs };
}
