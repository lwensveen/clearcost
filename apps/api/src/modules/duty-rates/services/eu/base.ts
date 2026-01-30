import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import sax from 'sax';
import { httpFetch } from '../../../../lib/http.js';

export const MFN_MEASURE_TYPE_ID = '103';
export const PREF_MEASURE_TYPE_IDS = new Set(['142', '145']);
export const ERGA_OMNES_ID = '1011';

const _geoDescCache = new Map<string, Promise<Map<string, string>>>();
const _dutyExprCache = new Map<string, Promise<Set<string>>>();

function _cacheKey(url: string, lang: string) {
  return `${url}::${lang.toUpperCase()}`;
}

export function toNumeric3String(n: number): string {
  const s = Number(n).toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}
export function hs6(x: string): string {
  return String(x ?? '')
    .replace(/\D/g, '')
    .slice(0, 6);
}
function isGzip(buf: Uint8Array) {
  return buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/** Fetch URL → Node Readable; transparently gunzip if gzipped. */
export async function fetchXmlStream(url: string): Promise<Readable> {
  const res = await httpFetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!res.ok || !res.body)
    throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${url}`);

  // Peek first chunk to detect gzip
  const reader = res.body.getReader();
  const head = await reader.read();
  const first = head.value ? new Uint8Array(head.value) : new Uint8Array();

  const src = new Readable({ read() {} });
  await (async () => {
    try {
      if (first.length) src.push(Buffer.from(first));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) src.push(Buffer.from(value));
      }
      src.push(null);
    } catch (e) {
      src.destroy(e as Error);
    }
  })();

  return isGzip(first) ? src.pipe(createGunzip()) : src;
}

/** ---------- MEASURE parsing ---------- */
export type MeasurePick = {
  sid: string;
  code10: string; // goods.nomenclature.item.id (10-digit)
  measureTypeId: string; // measure.type.id
  geoId: string; // geographical.area.id
  start?: string; // yyyy-mm-dd
  end?: string | null; // yyyy-mm-dd | null
};

export async function parseMeasures(
  measureUrl: string,
  keep: (m: MeasurePick) => boolean
): Promise<Map<string, MeasurePick>> {
  const picked = new Map<string, MeasurePick>();
  const s = sax.createStream(true, { trim: true, xmlns: false, lowercase: false });

  let cur: Partial<MeasurePick> | null = null;
  let curTag = '';

  s.on('opentag', (node) => {
    curTag = node.name;
    if (node.name === 'MEASURE') cur = {};
  });

  s.on('text', (txt) => {
    if (!cur) return;
    const t = txt.trim();
    if (!t) return;
    switch (curTag) {
      case 'measure.sid':
        cur.sid = t;
        break;
      case 'goods.nomenclature.item.id':
        cur.code10 = t;
        break;
      case 'measure.type.id':
        cur.measureTypeId = t;
        break;
      case 'geographical.area.id':
        cur.geoId = t;
        break;
      case 'validity.start.date':
        cur.start = t;
        break;
      case 'validity.end.date':
        cur.end = t;
        break;
    }
  });

  s.on('closetag', (name) => {
    curTag = '';
    if (name !== 'MEASURE' || !cur) return;
    const m = cur as MeasurePick;
    cur = null;

    if (!m.sid || !m.code10 || !m.measureTypeId || !m.geoId) return;
    if (!keep(m)) return;
    picked.set(m.sid, m);
  });

  const stream = await fetchXmlStream(measureUrl);
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(s)
      .on('end', () => resolve())
      .on('error', reject);
  });

  return picked;
}

/** ---------- COMPONENT parsing (refined with ad-valorem allowlist) ---------- */
export type ComponentPick = {
  measureSid: string;
  dutyAmount?: string;
  dutyExpressionId?: string;
  measurementUnitCode?: string;
  monetaryUnitCode?: string;
};

/**
 * Parse MEASURE_COMPONENT.xml for a set of measure SIDs and accumulate:
 *  - pct: ad-valorem percent (highest if multiple)
 *  - compound: true if any non-percent component is present
 *
 * If adValoremExprIds is provided, we treat a component as percent when its
 * duty.expression.id ∈ adValoremExprIds. Otherwise we fall back to the heuristic:
 * "no measurement/monetary unit" ⇒ percent.
 */
export async function parseComponents(
  componentUrl: string,
  keepSids: Set<string>,
  adValoremExprIds?: Set<string>
): Promise<Map<string, { pct: number | null; compound: boolean }>> {
  const acc = new Map<string, { pct: number | null; compound: boolean }>();
  const s = sax.createStream(true, { trim: true, xmlns: false, lowercase: false });

  let cur: Partial<ComponentPick> | null = null;
  let curTag = '';

  s.on('opentag', (node) => {
    curTag = node.name;
    if (node.name === 'MEASURE_COMPONENT') cur = {};
  });

  s.on('text', (txt) => {
    if (!cur) return;
    const t = txt.trim();
    if (!t) return;
    switch (curTag) {
      case 'measure.sid':
        cur.measureSid = t;
        break;
      case 'duty.amount':
        cur.dutyAmount = t;
        break;
      case 'duty.expression.id':
        cur.dutyExpressionId = t;
        break;
      case 'measurement.unit.code':
        cur.measurementUnitCode = t;
        break;
      case 'monetary.unit.code':
        cur.monetaryUnitCode = t;
        break;
    }
  });

  s.on('closetag', (name) => {
    curTag = '';
    if (name !== 'MEASURE_COMPONENT' || !cur) return;
    const c = cur as ComponentPick;
    cur = null;

    if (!c.measureSid || !keepSids.has(c.measureSid)) return;

    let st = acc.get(c.measureSid);
    if (!st) {
      st = { pct: null, compound: false };
      acc.set(c.measureSid, st);
    }

    const hasUnit = Boolean(c.measurementUnitCode) || Boolean(c.monetaryUnitCode);
    const exprId = c.dutyExpressionId ?? '';
    const exprSaysPercent = adValoremExprIds?.has(exprId) ?? false;

    // If we know the expression is ad-valorem, accept as %, otherwise use heuristic
    const treatAsPercent =
      exprSaysPercent || (!hasUnit && c.dutyAmount != null && c.dutyAmount !== '');

    if (treatAsPercent) {
      const n = Number(c.dutyAmount);
      if (Number.isFinite(n) && n >= 0) st.pct = st.pct == null ? n : Math.max(st.pct, n);
    } else {
      // Non-percent component → compound
      st.compound = true;
    }
  });

  const stream = await fetchXmlStream(componentUrl);
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(s)
      .on('end', () => resolve())
      .on('error', reject);
  });

  return acc;
}

/** INTERNAL: raw streaming parse of DUTY_EXPRESSION.xml(.gz) → allowlist of ad-valorem ids. */
async function _parseDutyExpressionsRaw(
  dutyExprUrl: string,
  preferredLang: string = 'EN'
): Promise<Set<string>> {
  type Pick = { id?: string; lang?: string; desc?: string };

  const fallbacks = new Map<string, string>(); // id → first seen description
  const best = new Map<string, string>(); // id → preferred language description

  const s = sax.createStream(true, { trim: true, xmlns: false, lowercase: false });
  let cur: Pick | null = null;
  let curTag = '';

  s.on('opentag', (node) => {
    curTag = node.name;
    if (node.name === 'DUTY_EXPRESSION') cur = {};
  });

  s.on('text', (txt) => {
    if (!cur) return;
    const t = txt.trim();
    if (!t) return;
    switch (curTag) {
      case 'duty.expression.id':
        cur.id = t;
        break;
      case 'language.id':
        cur.lang = t.toUpperCase();
        break;
      case 'description':
        cur.desc = t;
        break;
    }
  });

  s.on('closetag', (name) => {
    curTag = '';
    if (name !== 'DUTY_EXPRESSION' || !cur) return;
    const { id, lang, desc } = cur;
    cur = null;
    if (!id || !desc) return;

    if (!fallbacks.has(id)) fallbacks.set(id, desc);
    if (lang === preferredLang && !best.has(id)) best.set(id, desc);
  });

  const stream = await fetchXmlStream(dutyExprUrl);
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(s)
      .on('end', () => resolve())
      .on('error', reject);
  });

  // Choose best description for each id, then classify
  const descriptions = new Map<string, string>();
  for (const [id, d] of fallbacks.entries()) descriptions.set(id, d);
  for (const [id, d] of best.entries()) descriptions.set(id, d);

  const allow = new Set<string>();
  const rePercent = /%/;
  const reAdValorem = /\bad\s*valorem\b/i;

  for (const [id, d] of descriptions.entries()) {
    if (rePercent.test(d) || reAdValorem.test(d)) allow.add(id);
  }
  return allow;
}

/**
 * CACHED: Parse DUTY_EXPRESSION.xml(.gz) once per (url, lang).
 * Pass { refresh: true } to bypass the cache for this call.
 */
export async function parseDutyExpressions(
  dutyExprUrl: string,
  preferredLang: string = 'EN',
  opts?: { refresh?: boolean }
): Promise<Set<string>> {
  const key = _cacheKey(dutyExprUrl, preferredLang);
  if (!opts?.refresh) {
    const cached = _dutyExprCache.get(key);
    if (cached) return cached;
  }
  const promise = _parseDutyExpressionsRaw(dutyExprUrl, preferredLang);
  _dutyExprCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    _dutyExprCache.delete(key);
    throw e;
  }
}

/** INTERNAL: raw streaming parse of GEOGRAPHICAL_AREA_DESCRIPTION.xml(.gz). */
async function _parseGeoAreaDescriptionsRaw(
  descriptionUrl: string,
  preferredLang: string = 'EN'
): Promise<Map<string, string>> {
  type Pick = { geoId?: string; lang?: string; text?: string };

  const best = new Map<string, string>(); // geoId → preferred language name
  const fallback = new Map<string, string>(); // geoId → first seen name

  const s = sax.createStream(true, { trim: true, xmlns: false, lowercase: false });

  let cur: Pick | null = null;
  let curTag = '';

  s.on('opentag', (node) => {
    curTag = node.name;
    if (node.name === 'GEOGRAPHICAL_AREA_DESCRIPTION') cur = {};
  });

  s.on('text', (txt) => {
    if (!cur) return;
    const t = txt.trim();
    if (!t) return;

    switch (curTag) {
      case 'geographical.area.id':
        cur.geoId = t;
        break;
      case 'language.id':
        cur.lang = t.toUpperCase();
        break;
      case 'description':
        cur.text = t;
        break;
    }
  });

  s.on('closetag', (name) => {
    curTag = '';
    if (name !== 'GEOGRAPHICAL_AREA_DESCRIPTION' || !cur) return;

    const { geoId, lang, text } = cur;
    cur = null;

    if (!geoId || !text) return;

    if (!fallback.has(geoId)) fallback.set(geoId, text);
    if (lang === preferredLang && !best.has(geoId)) best.set(geoId, text);
  });

  const stream = await fetchXmlStream(descriptionUrl);
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(s)
      .on('end', () => resolve())
      .on('error', reject);
  });

  // Fill with fallbacks where no preferred language was found
  for (const [geoId, name] of fallback.entries()) {
    if (!best.has(geoId)) best.set(geoId, name);
  }
  return best;
}

/**
 * CACHED: Parse GEOGRAPHICAL_AREA_DESCRIPTION.xml(.gz) once per (url, lang).
 * Pass { refresh: true } to bypass the cache for this call.
 */
export async function parseGeoAreaDescriptions(
  descriptionUrl: string,
  preferredLang: string = 'EN',
  opts?: { refresh?: boolean }
): Promise<Map<string, string>> {
  const key = _cacheKey(descriptionUrl, preferredLang);
  if (!opts?.refresh) {
    const cached = _geoDescCache.get(key);
    if (cached) return cached;
  }
  const promise = _parseGeoAreaDescriptionsRaw(descriptionUrl, preferredLang);
  // De-dupe concurrent callers and avoid caching failures permanently
  _geoDescCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    _geoDescCache.delete(key);
    throw e;
  }
}
