import { db, surchargesTable } from '@clearcost/db';
import type { SurchargeInsert } from '@clearcost/types';
import { batchUpsertSurchargesFromStream } from '../../utils/batch-upsert.js';
import { and, desc, eq, isNull, lt, lte, sql } from 'drizzle-orm';
import { httpFetch } from '../../../../lib/http.js';

/**
 * Compute US Fiscal Year for a given UTC date.
 * FY n starts on Oct 1 of (n-1), ends Sep 30 of n.
 */
export function fiscalYear(d = new Date()): number {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return m >= 9 ? y + 1 : y;
}

/** yyyy-10-01 UTC for the start of FY yyyy */
function fyStartUTC(fy: number): Date {
  return new Date(Date.UTC(fy - 1, 9, 1));
}

/** Final-resort statute defaults (only used if we can't parse or carry-forward) */
const MPF_RATE_FALLBACK = 0.003464; // 0.3464%
const HMF_RATE_FALLBACK = 0.00125; // 0.125%

/** Helper: convert number -> string for SurchargeInsert numeric fields */
const numStr = (n: number | null | undefined): string | null =>
  typeof n === 'number' && Number.isFinite(n) ? String(n) : null;

/** Federal Register API fetch for CBP “Customs User Fees” FY notice */
async function fetchFRDocForFY(
  fy: number
): Promise<{ html: string; cite: string; url: string | null } | null> {
  const from = `${fy - 1}-07-01`;
  const to = `${fy - 1}-09-30`;

  const url = new URL('https://www.federalregister.gov/api/v1/documents.json');
  url.searchParams.set('per_page', '10');
  url.searchParams.append('conditions[agencies][]', 'U.S. Customs and Border Protection');
  url.searchParams.set('conditions[publication_date][gte]', from);
  url.searchParams.set('conditions[publication_date][lte]', to);
  url.searchParams.set('conditions[term]', `Customs User Fees Fiscal Year ${fy}`);

  const r = await httpFetch(url.toString(), { headers: { 'user-agent': 'clearcost-importer' } });
  if (!r.ok) return null;

  const json = await r.json();
  const docs: any[] = json?.results ?? [];
  const pick =
    docs.find((d) => /customs user fees/i.test(d.title) && /adjust/i.test(d.title)) ||
    docs.find((d) => /customs user fees/i.test(d.title)) ||
    docs[0];

  if (!pick?.body_html) return null;

  const citeParts = [pick.citation || pick.document_number, pick.publication_date].filter(Boolean);
  const cite = citeParts.join(' • ');
  const publicUrl: string | null = pick.html_url || pick.public_inspection_pdf_url || null;

  return { html: String(pick.body_html), cite, url: publicUrl };
}

/** Parse MPF min/max $ from the FR “Limitations on COBRA Fees …” table */
function parseMpfMinMaxFromFR(html: string): { minUSD: number; maxUSD: number } | null {
  const rowMatch = html.match(
    /Merchandise\s+processing\s+fees[\s\S]{0,800}?Minimum[\s\S]{0,200}?\$?([\d,]+\.\d{2})[\s\S]{0,400}?Maximum[\s\S]{0,200}?\$?([\d,]+\.\d{2})/i
  );
  if (!rowMatch) return null;
  const minUSD = Number(rowMatch[1]!.replace(/,/g, ''));
  const maxUSD = Number(rowMatch[2]!.replace(/,/g, ''));
  if (!Number.isFinite(minUSD) || !Number.isFinite(maxUSD)) return null;
  return { minUSD, maxUSD };
}

/** Try to parse MPF ad-valorem (as a fraction) from FR HTML (e.g., “0.3464%”). */
function parseMpfRateFromFR(html: string): number | null {
  const win = html.slice(0, 200_000);
  const m =
    win.match(/Merchandise\s+processing\s+fee[\s\S]{0,300}?(\d+(?:\.\d+)?)\s*%/i) ||
    win.match(/Merchandise\s+processing\s+fee[\s\S]{0,300}?(\d+(?:\.\d+)?)\s*percent/i);
  if (!m) return null;
  const pct = Number(m[1]);
  if (!Number.isFinite(pct)) return null;
  return pct / 100;
}

/** Read the most recent pctAmt for a code on/before a date, if present in DB */
async function getLastPctFromDB(
  dest: string,
  code: (typeof surchargesTable.$inferInsert)['surchargeCode'],
  on: Date
): Promise<number | null> {
  const rows = await db
    .select({ pct: surchargesTable.pctAmt, ef: surchargesTable.effectiveFrom })
    .from(surchargesTable)
    .where(
      and(
        eq(surchargesTable.dest, dest),
        eq(surchargesTable.surchargeCode, code),
        lte(surchargesTable.effectiveFrom, on)
      )
    )
    .orderBy(desc(surchargesTable.effectiveFrom))
    .limit(1);

  const s = rows[0]?.pct;
  return typeof s === 'string' && s.trim() !== '' ? Number(s) : null;
}

/**
 * Upsert US base surcharges for a given FY:
 *  - MPF (ad valorem “dynamic”; min/max via FR when available) — ALL modes
 *  - HMF (ad valorem “dynamic”) — OCEAN only
 *
 * Rate sourcing order:
 *   MPF: parse FR → carry-forward from DB → statutory fallback
 *   HMF: carry-forward from DB → statutory fallback
 *
 * Also: close any older, open windows for these codes at FY start to prevent overlap.
 */
export async function upsertUSBaseSurcharges(opts?: { fy?: number; importId?: string }) {
  const fy = opts?.fy ?? fiscalYear(new Date());
  const ef = fyStartUTC(fy);
  const dest = 'US';

  // --- CLOSE OUT prior open rows for MPF/HMF at ef (no overlap)
  // MPF (ALL, ENTRY)
  await db
    .update(surchargesTable)
    .set({ effectiveTo: ef, updatedAt: sql`now()` })
    .where(
      and(
        eq(surchargesTable.dest, dest),
        eq(surchargesTable.surchargeCode, 'MPF'),
        eq(surchargesTable.transportMode, 'ALL'),
        eq(surchargesTable.applyLevel, 'entry'),
        lt(surchargesTable.effectiveFrom, ef),
        isNull(surchargesTable.effectiveTo)
      )
    );

  // HMF (OCEAN, ENTRY)
  await db
    .update(surchargesTable)
    .set({ effectiveTo: ef, updatedAt: sql`now()` })
    .where(
      and(
        eq(surchargesTable.dest, dest),
        eq(surchargesTable.surchargeCode, 'HMF'),
        eq(surchargesTable.transportMode, 'OCEAN'),
        eq(surchargesTable.applyLevel, 'entry'),
        lt(surchargesTable.effectiveFrom, ef),
        isNull(surchargesTable.effectiveTo)
      )
    );

  // --- Discover MPF details
  const fr = await fetchFRDocForFY(fy);
  const minmax = fr ? parseMpfMinMaxFromFR(fr.html) : null;

  // ad-valorem discovery for MPF
  const parsedFromFR = fr ? parseMpfRateFromFR(fr.html) : null;
  const carried = await getLastPctFromDB(dest, 'MPF', ef);
  const mpfRate = parsedFromFR ?? carried ?? MPF_RATE_FALLBACK;

  const mpfNotes = [
    `US MPF ad valorem ${(mpfRate * 100).toFixed(4)}%`,
    minmax
      ? `FY ${fy} min $${minmax.minUSD.toFixed(2)}, max $${minmax.maxUSD.toFixed(2)}`
      : `FY ${fy} min/max unavailable at run time`,
    'CFR: 19 CFR §24.23(b)(1)(i)(A)-(B)',
    fr ? `FR: ${fr.cite}` : '',
    parsedFromFR != null
      ? '(rate: FR parsed)'
      : carried != null
        ? '(rate: carried from prior year)'
        : '(rate: statutory fallback)',
  ]
    .filter(Boolean)
    .join('. ');

  // --- HMF rate: carry-forward else statute
  const hmfCarried = await getLastPctFromDB(dest, 'HMF', ef);
  const hmfRate = hmfCarried ?? HMF_RATE_FALLBACK;

  const rows: SurchargeInsert[] = [
    // MPF — ALL modes; ENTRY level; ad valorem on customs value
    {
      dest,
      origin: null,
      hs6: null,
      surchargeCode: 'MPF',
      rateType: 'ad_valorem',
      applyLevel: 'entry',
      valueBasis: 'customs',
      transportMode: 'ALL',
      currency: 'USD',
      fixedAmt: null,
      pctAmt: numStr(mpfRate),
      minAmt: numStr(minmax?.minUSD ?? null),
      maxAmt: numStr(minmax?.maxUSD ?? null),
      unitAmt: null,
      unitCode: null,
      sourceUrl: fr?.url ?? null,
      sourceRef: fr ? `FR ${fr.cite}` : null,
      notes: mpfNotes,
      effectiveFrom: ef,
      effectiveTo: null,
    },
    // HMF — OCEAN only; ENTRY level; ad valorem on customs value
    {
      dest,
      origin: null,
      hs6: null,
      surchargeCode: 'HMF',
      rateType: 'ad_valorem',
      applyLevel: 'entry',
      valueBasis: 'customs',
      transportMode: 'OCEAN',
      currency: 'USD',
      fixedAmt: null,
      pctAmt: numStr(hmfRate),
      minAmt: null,
      maxAmt: null,
      unitAmt: null,
      unitCode: null,
      sourceUrl: null,
      sourceRef: '26 U.S.C. §4461',
      notes:
        (hmfCarried != null
          ? 'US Harbor Maintenance Fee 0.125% (ocean shipments only). (rate: carried from prior year)'
          : 'US Harbor Maintenance Fee 0.125% (ocean shipments only). (rate: statutory fallback)') +
        ' Statute: 26 U.S.C. §4461. Enforce by mode in rating.',
      effectiveFrom: ef,
      effectiveTo: null,
    },
  ];

  const res = await batchUpsertSurchargesFromStream(rows, {
    batchSize: 100,
    importId: opts?.importId,
    makeSourceRef: (r) => {
      const efS =
        r.effectiveFrom instanceof Date
          ? r.effectiveFrom.toISOString().slice(0, 10)
          : String(r.effectiveFrom ?? '');
      return `cbp:${r.surchargeCode.toLowerCase()}:fy=${fy}:ef=${efS}`;
    },
  });

  return { ok: true as const, count: res.count ?? 0, fy };
}
