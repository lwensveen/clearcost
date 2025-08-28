import { importDeMinimis } from './import-de-minimis.js';

type Row = {
  dest: string; // ISO-3166-1 alpha-2
  deMinimisKind: 'DUTY' | 'VAT'; // per-type threshold
  deMinimisBasis: 'INTRINSIC' | 'CIF'; // goods-only vs CIF
  currency: string; // ISO-4217
  value: number | string; // threshold amount
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null; // optional
  sourceUrl: string; // provenance (not stored)
};

const EU_DESTS = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
];

const toISO = (d: Date) => d.toISOString().slice(0, 10);

// ---------- Jurisdiction adapters (return typed rows) ----------
async function fetchUS(effectiveFrom: string): Promise<Row[]> {
  // CBP Section 321 (intrinsic value)
  return [
    {
      dest: 'US',
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'USD',
      value: 800,
      effectiveFrom,
      sourceUrl: 'https://www.cbp.gov/trade/trade-enforcement/tftea/section-321-programs',
    },
  ];
}

async function fetchEU(effectiveFrom: string): Promise<Row[]> {
  // EU duty relief €150 (intrinsic). VAT exemption removed (omit VAT rows).

  return EU_DESTS.map((dest) => ({
    dest,
    deMinimisKind: 'DUTY',
    deMinimisBasis: 'INTRINSIC',
    currency: 'EUR',
    value: 150,
    effectiveFrom,
    sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2009/1186/oj',
  }));
}

async function fetchUK(effectiveFrom: string): Promise<Row[]> {
  // UK VAT ≤ £135 (intrinsic, POS collection). Duty rules vary; omit for now.
  return [
    {
      dest: 'GB',
      deMinimisKind: 'VAT',
      deMinimisBasis: 'INTRINSIC',
      currency: 'GBP',
      value: 135,
      effectiveFrom,
      sourceUrl:
        'https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk',
    },
  ];
}

async function fetchCA(effectiveFrom: string): Promise<Row[]> {
  // CBSA CUSMA courier thresholds (intrinsic): CAD 40 tax, CAD 150 duty
  return [
    {
      dest: 'CA',
      deMinimisKind: 'VAT', // treat taxes as VAT-equivalent
      deMinimisBasis: 'INTRINSIC',
      currency: 'CAD',
      value: 40,
      effectiveFrom,
      sourceUrl: 'https://www.cbsa-asfc.gc.ca/services/cusma-aceum/lvs-efv-eng.html',
    },
    {
      dest: 'CA',
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'CAD',
      value: 150,
      effectiveFrom,
      sourceUrl: 'https://www.cbsa-asfc.gc.ca/publications/dm-md/d8/d8-2-16-eng.html',
    },
  ];
}

async function fetchAU(_effectiveFrom: string): Promise<Row[]> {
  // GST collected at POS on low-value goods; no border VAT relief -> omit rows.
  return [];
}

/**
 * Import official de minimis thresholds. If `effectiveOn` is provided, rows will
 * use that YYYY-MM-DD as their `effectiveFrom`; otherwise “today” (UTC).
 */
export async function importDeMinimisFromOfficial(effectiveOn?: Date) {
  const effectiveFrom = toISO(effectiveOn ?? new Date());

  const [us, eu, uk, ca, au] = await Promise.all([
    fetchUS(effectiveFrom),
    fetchEU(effectiveFrom),
    fetchUK(effectiveFrom),
    fetchCA(effectiveFrom),
    fetchAU(effectiveFrom),
  ]);

  const rows = [...us, ...eu, ...uk, ...ca, ...au].map((r) => ({
    dest: r.dest,
    deMinimisKind: r.deMinimisKind,
    deMinimisBasis: r.deMinimisBasis,
    currency: r.currency,
    value: r.value,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo ?? null,
  }));

  const res = await importDeMinimis(rows);
  return { ok: true as const, inserted: res.count, effectiveFrom };
}
