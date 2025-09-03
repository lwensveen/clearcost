import { db, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { decode as decodeEntities } from 'he';

// SDMX endpoints (data + DSD)
const SDMX_DATA_BASE = 'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS';
const SDMX_DSD_URL =
  'https://wits.worldbank.org/API/V1/SDMX/V21/rest/datastructure/WBG_WITS/TARIFF_TRAINS/';

// URL-based metadata fallback (XML)
const URL_PRODUCTS_ALL = 'https://wits.worldbank.org/API/V1/wits/datasource/trn/product/all';

const ACCEPT_DATA = 'application/vnd.sdmx.data+json;version=1.0.0-wd';
const ACCEPT_STRUCT = 'application/vnd.sdmx.structure+json;version=1.0.0-wd';

type ImportHs6FromWitsResult = {
  ok: true;
  count: number;
  inserted: number;
  updated: number;
};

const baseHeaders = { 'user-agent': 'clearcost-importer' };

function isHS6(code?: string) {
  return !!code && /^\d{6}$/.test(code);
}

function takeName(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return takeName(v[0]);
  if (typeof v === 'object') return v.value ?? v.en ?? v.label ?? v['#text'] ?? '';
  return String(v);
}

function sanitizeTitle(raw: string): string {
  const stripped = sanitizeHtml(String(raw ?? ''), {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'noscript'],
  });

  let text = decodeEntities(stripped);

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 500) text = text.slice(0, 500);
  return text;
}

// 1) Try SDMX /data (JSON)
async function fetchHs6ViaData(year: number) {
  const path = `A.842.0..reported`; // reporter=USA, partner=WLD, wildcard product
  const url = `${SDMX_DATA_BASE}/${path}?startPeriod=${year}&endPeriod=${year}&detail=DataOnly`;
  const r = await fetch(url, { headers: { ...baseHeaders, accept: ACCEPT_DATA } });
  if (!r.ok) throw new Error(`WITS /data fetch failed ${r.status} ${r.statusText}`);
  const json: any = await r.json();

  const seriesDims: any[] = json?.structure?.dimensions?.series ?? [];
  const prodIdx = seriesDims.findIndex((d: any) =>
    String(d?.id ?? '')
      .toUpperCase()
      .includes('PRODUCT')
  );
  if (prodIdx < 0) throw new Error('WITS /data: PRODUCT dimension not found');
  const values: any[] = seriesDims[prodIdx]?.values ?? [];

  const uniq = new Map<string, string>();
  for (const v of values) {
    const code = v?.id;
    if (!isHS6(code)) continue;
    const title = sanitizeTitle(takeName(v?.name));
    if (!uniq.has(code)) uniq.set(code, title || '—');
  }
  return Array.from(uniq, ([hs6, title]) => ({ hs6, title }));
}

// 2) Try SDMX DSD (JSON). Some WITS deployments may only return XML here.
async function fetchHs6ViaDSD_JSON() {
  const r = await fetch(SDMX_DSD_URL, { headers: { ...baseHeaders, accept: ACCEPT_STRUCT } });
  if (!r.ok) throw new Error(`WITS /datastructure fetch failed ${r.status} ${r.statusText}`);
  const json: any = await r.json();

  // Handle both {structure:{codelists:{codelist:[...]}}} and flattened variants
  const dsd =
    json?.structure?.dataStructures?.[0]?.dataStructure ?? json?.structure?.dataStructures?.[0];
  const seriesDims: any[] = dsd?.dimensions?.series ?? dsd?.dimensions?.Series ?? [];

  const productDim = seriesDims.find((d: any) =>
    String(d?.id ?? '')
      .toUpperCase()
      .includes('PRODUCT')
  );
  const clRefId: string | undefined =
    productDim?.localRepresentation?.enumeration?.ref?.id ??
    productDim?.LocalRepresentation?.Enumeration?.Ref?.id ??
    productDim?.local_representation?.enumeration?.ref?.id;

  // Pull out codelists regardless of shape
  const clContainer = json?.structure?.codelists;
  const clArray =
    (Array.isArray(clContainer?.codelist) ? clContainer.codelist : null) ??
    (Array.isArray(clContainer) ? clContainer : null) ??
    [];

  const cl: any =
    clArray.find(
      (c: any) => String(c?.id ?? '').toUpperCase() === String(clRefId ?? '').toUpperCase()
    ) ??
    clArray.find((c: any) =>
      String(c?.id ?? c?.name ?? '')
        .toUpperCase()
        .includes('PRODUCT')
    ) ??
    clArray.find((c: any) =>
      String(c?.id ?? c?.name ?? '')
        .toUpperCase()
        .includes('HS')
    );

  const items: any[] = cl?.items ?? cl?.Codes ?? cl?.code ?? [];
  const uniq = new Map<string, string>();
  for (const it of items) {
    const code = it?.id ?? it?.value ?? it?.code;
    if (!isHS6(code)) continue;
    const title = sanitizeTitle(takeName(it?.name ?? it?.description ?? it?.label));
    if (!uniq.has(code)) uniq.set(code, title || '—');
  }
  return Array.from(uniq, ([hs6, title]) => ({ hs6, title }));
}

// 3) FINAL fallback: URL-based metadata (XML) — guaranteed to list all HS6 products
async function fetchHs6ViaURL_XML() {
  const r = await fetch(URL_PRODUCTS_ALL, {
    headers: { ...baseHeaders, accept: 'application/xml' },
  });
  if (!r.ok) throw new Error(`WITS product/all fetch failed ${r.status} ${r.statusText}`);
  const xml = await r.text();

  const re =
    /<wits:product\s+productcode="(\d{6})"[\s\S]*?<wits:productdescription>([\s\S]*?)<\/wits:productdescription>/g;
  const uniq = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const hs6 = m[1]!;
    const raw = m[2] ?? '';
    const title = sanitizeTitle(raw) || '—';
    if (!uniq.has(hs6)) uniq.set(hs6, title);
  }
  return Array.from(uniq, ([hs6, title]) => ({ hs6, title }));
}

async function fetchHs6FromWits(year: number) {
  // Try /data → DSD(JSON) → URL(XML)
  try {
    return await fetchHs6ViaData(year);
  } catch (e) {
    console.warn('HS6: /data failed, trying DSD(JSON):', (e as Error)?.message ?? e);
  }
  try {
    const viaDSD = await fetchHs6ViaDSD_JSON();
    if (viaDSD.length) return viaDSD;
    console.warn('HS6: DSD(JSON) returned 0 items, falling back to URL/XML');
  } catch (e) {
    console.warn('HS6: DSD(JSON) failed, falling back to URL/XML:', (e as Error)?.message ?? e);
  }
  return await fetchHs6ViaURL_XML();
}

export async function importHs6FromWits(year?: number): Promise<ImportHs6FromWitsResult> {
  const targetYear = year ?? new Date().getUTCFullYear() - 1; // WITS data is typically T-1
  const rows = await fetchHs6FromWits(targetYear);
  if (!rows.length) return { ok: true as const, count: 0, inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;
  const batchSize = 2000;

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);

      // Upsert only when the title actually changed (setWhere),
      // and get per-row insert/update signal from xmax.
      const ret = await trx
        .insert(hsCodesTable)
        .values(chunk.map((r) => ({ hs6: r.hs6, title: r.title })))
        .onConflictDoUpdate({
          target: hsCodesTable.hs6,
          set: { title: sql`excluded.title`, updatedAt: sql`now()` },
          setWhere: sql`${hsCodesTable.title} is distinct from excluded.title`,
        })
        .returning({
          // Inserted rows have (xmax = 0) for the returned tuple; cast to int for easy summing.
          inserted: sql<number>`(xmax = 0)::int`,
        });

      for (const row of ret) {
        if (row.inserted === 1) inserted++;
        else updated++;
      }
    }
  });

  return { ok: true as const, count: inserted + updated, inserted, updated };
}
