import { db, hsCodesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { decode as decodeEntities } from 'he';
import { httpFetch } from '../../../lib/http.js';
import {
  resolveWitsHsSourceUrls,
  type ResolveWitsHsSourceUrlsOptions,
} from './wits-source-urls.js';

const ACCEPT_DATA = 'application/vnd.sdmx.data+json;version=1.0.0-wd';
const ACCEPT_STRUCT = 'application/vnd.sdmx.structure+json;version=1.0.0-wd';
type WitsHsSourceUrls = Awaited<ReturnType<typeof resolveWitsHsSourceUrls>>;

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

function takeName(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return takeName(v[0]);
  if (typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    return String(rec.value ?? rec.en ?? rec.label ?? rec['#text'] ?? '');
  }
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
async function fetchHs6ViaData(year: number, sourceUrls: WitsHsSourceUrls) {
  const path = `A.842.0..reported`; // reporter=USA, partner=WLD, wildcard product
  const url = `${sourceUrls.dataBaseUrl}/${path}?startPeriod=${year}&endPeriod=${year}&detail=DataOnly`;
  const r = await httpFetch(url, { headers: { ...baseHeaders, accept: ACCEPT_DATA } });
  if (!r.ok) throw new Error(`WITS /data fetch failed ${r.status} ${r.statusText}`);
  const json = (await r.json()) as Record<string, unknown>;

  const structure = json?.structure as Record<string, unknown> | undefined;
  const dimensions = structure?.dimensions as Record<string, unknown> | undefined;
  const seriesDims = (dimensions?.series ?? []) as Array<Record<string, unknown>>;
  const prodIdx = seriesDims.findIndex((d) =>
    String(d?.id ?? '')
      .toUpperCase()
      .includes('PRODUCT')
  );
  if (prodIdx < 0) throw new Error('WITS /data: PRODUCT dimension not found');
  const values = (seriesDims[prodIdx]?.values ?? []) as Array<Record<string, unknown>>;

  const uniq = new Map<string, string>();
  for (const v of values) {
    const code = v?.id as string | undefined;
    if (!isHS6(code)) continue;
    const title = sanitizeTitle(takeName(v?.name));
    if (!uniq.has(code as string)) uniq.set(code as string, title || '—');
  }
  return Array.from(uniq, ([hs6, title]) => ({ hs6, title }));
}

// 2) Try SDMX DSD (JSON). Some WITS deployments may only return XML here.
async function fetchHs6ViaDSD_JSON(sourceUrls: WitsHsSourceUrls) {
  const r = await httpFetch(sourceUrls.dsdUrl, {
    headers: { ...baseHeaders, accept: ACCEPT_STRUCT },
  });
  if (!r.ok) throw new Error(`WITS /datastructure fetch failed ${r.status} ${r.statusText}`);
  const json = (await r.json()) as Record<string, unknown>;

  // Handle both {structure:{codelists:{codelist:[...]}}} and flattened variants
  const jsonStructure = json?.structure as Record<string, unknown> | undefined;
  const dataStructures = jsonStructure?.dataStructures as
    | Array<Record<string, unknown>>
    | undefined;
  const dsd = ((dataStructures?.[0] as Record<string, unknown>)?.dataStructure ??
    dataStructures?.[0]) as Record<string, unknown> | undefined;
  const dsdDimensions = dsd?.dimensions as Record<string, unknown> | undefined;
  const seriesDims = (dsdDimensions?.series ?? dsdDimensions?.Series ?? []) as Array<
    Record<string, unknown>
  >;

  const productDim = seriesDims.find((d) =>
    String(d?.id ?? '')
      .toUpperCase()
      .includes('PRODUCT')
  );
  const prodLocalRep = productDim?.localRepresentation as Record<string, unknown> | undefined;
  const prodLocalRepAlt = productDim?.LocalRepresentation as Record<string, unknown> | undefined;
  const prodLocalRepSnake = productDim?.local_representation as Record<string, unknown> | undefined;
  const enumRef = (prodLocalRep?.enumeration as Record<string, unknown>)?.ref as
    | Record<string, unknown>
    | undefined;
  const enumRefAlt = (prodLocalRepAlt?.Enumeration as Record<string, unknown>)?.Ref as
    | Record<string, unknown>
    | undefined;
  const enumRefSnake = (prodLocalRepSnake?.enumeration as Record<string, unknown>)?.ref as
    | Record<string, unknown>
    | undefined;
  const clRefId: string | undefined =
    (enumRef?.id as string | undefined) ??
    (enumRefAlt?.id as string | undefined) ??
    (enumRefSnake?.id as string | undefined);

  // Pull out codelists regardless of shape
  const clContainer = jsonStructure?.codelists as Record<string, unknown> | undefined;
  const clContainerCodelist = clContainer?.codelist;
  const clArray: Array<Record<string, unknown>> =
    (Array.isArray(clContainerCodelist) ? clContainerCodelist : null) ??
    (Array.isArray(clContainer) ? clContainer : null) ??
    [];

  const cl: Record<string, unknown> | undefined =
    clArray.find(
      (c) => String(c?.id ?? '').toUpperCase() === String(clRefId ?? '').toUpperCase()
    ) ??
    clArray.find((c) =>
      String(c?.id ?? c?.name ?? '')
        .toUpperCase()
        .includes('PRODUCT')
    ) ??
    clArray.find((c) =>
      String(c?.id ?? c?.name ?? '')
        .toUpperCase()
        .includes('HS')
    );

  const items = (cl?.items ?? cl?.Codes ?? cl?.code ?? []) as Array<Record<string, unknown>>;
  const uniq = new Map<string, string>();
  for (const it of items) {
    const code = (it?.id ?? it?.value ?? it?.code) as string | undefined;
    if (!isHS6(code)) continue;
    const title = sanitizeTitle(takeName(it?.name ?? it?.description ?? it?.label));
    if (!uniq.has(code as string)) uniq.set(code as string, title || '—');
  }
  return Array.from(uniq, ([hs6, title]) => ({ hs6, title }));
}

// 3) FINAL fallback: URL-based metadata (XML) — guaranteed to list all HS6 products
async function fetchHs6ViaURL_XML(sourceUrls: WitsHsSourceUrls) {
  const r = await httpFetch(sourceUrls.productsAllUrl, {
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

async function fetchHs6FromWits(year: number, sourceUrls: WitsHsSourceUrls) {
  // Try /data → DSD(JSON) → URL(XML)
  try {
    return await fetchHs6ViaData(year, sourceUrls);
  } catch (e: unknown) {
    console.warn('HS6: /data failed, trying DSD(JSON):', e instanceof Error ? e.message : e);
  }
  try {
    const viaDSD = await fetchHs6ViaDSD_JSON(sourceUrls);
    if (viaDSD.length) return viaDSD;
    console.warn('HS6: DSD(JSON) returned 0 items, falling back to URL/XML');
  } catch (e: unknown) {
    console.warn(
      'HS6: DSD(JSON) failed, falling back to URL/XML:',
      e instanceof Error ? e.message : e
    );
  }
  return await fetchHs6ViaURL_XML(sourceUrls);
}

export async function importHs6FromWits(
  year?: number,
  sourceOpts: ResolveWitsHsSourceUrlsOptions = {}
): Promise<ImportHs6FromWitsResult> {
  const targetYear = year ?? new Date().getUTCFullYear() - 1; // WITS data is typically T-1
  const sourceUrls = await resolveWitsHsSourceUrls(sourceOpts);
  const rows = await fetchHs6FromWits(targetYear, sourceUrls);
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
