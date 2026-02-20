import { importDeMinimis } from './import-de-minimis.js';
import type { DeMinimisInsert } from '@clearcost/types';
import { resolveOfficialDeMinimisSourceUrls } from './source-urls.js';

type Row = {
  dest: string; // ISO-3166-1 alpha-2
  deMinimisKind: 'DUTY' | 'VAT';
  deMinimisBasis: 'INTRINSIC' | 'CIF';
  currency: string; // ISO-4217
  value: number | string; // threshold amount
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null;
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
const toDate = (s: string | null | undefined) =>
  s ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null;

// ---------- Jurisdiction adapters ----------
async function fetchUS(effectiveFrom: string): Promise<Row[]> {
  return [
    {
      dest: 'US',
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'USD',
      value: 800,
      effectiveFrom,
    },
  ];
}

async function fetchEU(effectiveFrom: string): Promise<Row[]> {
  return EU_DESTS.map((dest) => ({
    dest,
    deMinimisKind: 'DUTY',
    deMinimisBasis: 'INTRINSIC',
    currency: 'EUR',
    value: 150,
    effectiveFrom,
  }));
}

async function fetchUK(effectiveFrom: string): Promise<Row[]> {
  return [
    {
      dest: 'GB',
      deMinimisKind: 'VAT',
      deMinimisBasis: 'INTRINSIC',
      currency: 'GBP',
      value: 135,
      effectiveFrom,
    },
  ];
}

async function fetchCA(effectiveFrom: string): Promise<Row[]> {
  return [
    {
      dest: 'CA',
      deMinimisKind: 'VAT',
      deMinimisBasis: 'INTRINSIC',
      currency: 'CAD',
      value: 40,
      effectiveFrom,
    },
    {
      dest: 'CA',
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'CAD',
      value: 150,
      effectiveFrom,
    },
  ];
}

async function fetchAU(_effectiveFrom: string): Promise<Row[]> {
  return [];
}

function resolveOfficialSourceKey(
  row: Pick<DeMinimisInsert, 'dest' | 'deMinimisKind'>
): string | null {
  if (row.dest === 'US' && row.deMinimisKind === 'DUTY') return 'de-minimis.official.us.section321';
  if (EU_DESTS.includes(row.dest) && row.deMinimisKind === 'DUTY')
    return 'de-minimis.official.eu.reg_1186_2009';
  if (row.dest === 'GB' && row.deMinimisKind === 'VAT')
    return 'de-minimis.official.gb.vat_overseas_goods';
  if (row.dest === 'CA' && row.deMinimisKind === 'VAT') return 'de-minimis.official.ca.lvs_vat';
  if (row.dest === 'CA' && row.deMinimisKind === 'DUTY') return 'de-minimis.official.ca.lvs_duty';
  return null;
}

function resolveOfficialSourceUrl(
  row: Pick<DeMinimisInsert, 'dest' | 'deMinimisKind'>,
  urls: Awaited<ReturnType<typeof resolveOfficialDeMinimisSourceUrls>>
): string | null {
  if (row.dest === 'US' && row.deMinimisKind === 'DUTY') return urls.usSection321;
  if (EU_DESTS.includes(row.dest) && row.deMinimisKind === 'DUTY') return urls.euRegulation;
  if (row.dest === 'GB' && row.deMinimisKind === 'VAT') return urls.gbVatGuidance;
  if (row.dest === 'CA' && row.deMinimisKind === 'VAT') return urls.caLvsVat;
  if (row.dest === 'CA' && row.deMinimisKind === 'DUTY') return urls.caLvsDuty;
  return null;
}

/**
 * Import official de minimis thresholds.
 * Optional: pass { importId } to record provenance via importDeMinimis.
 */
export async function importDeMinimisFromOfficial(
  effectiveOn?: Date,
  opts?: { importId?: string }
) {
  const effectiveFrom = toISO(effectiveOn ?? new Date());
  const sourceUrls = await resolveOfficialDeMinimisSourceUrls();

  const [us, eu, uk, ca, au] = await Promise.all([
    fetchUS(effectiveFrom),
    fetchEU(effectiveFrom),
    fetchUK(effectiveFrom),
    fetchCA(effectiveFrom),
    fetchAU(effectiveFrom),
  ]);

  const rows: DeMinimisInsert[] = [...us, ...eu, ...uk, ...ca, ...au].map((r) => ({
    dest: r.dest,
    deMinimisKind: r.deMinimisKind,
    deMinimisBasis: r.deMinimisBasis,
    currency: r.currency,
    value: String(r.value),
    effectiveFrom: toDate(r.effectiveFrom)!,
    effectiveTo: toDate(r.effectiveTo ?? null) ?? null,
  }));

  if (rows.length === 0) {
    throw new Error('[De Minimis Official] source produced 0 rows.');
  }

  const res = await importDeMinimis(rows, {
    importId: opts?.importId,
    sourceKey: (row) => resolveOfficialSourceKey(row),
    makeSourceRef: (row) =>
      `official:deminimis:dest=${row.dest}:kind=${row.deMinimisKind}:source=${resolveOfficialSourceUrl(
        row,
        sourceUrls
      )}:ef=${row.effectiveFrom.toISOString().slice(0, 10)}`,
  });

  return { ok: true as const, inserted: res.count, effectiveFrom };
}
