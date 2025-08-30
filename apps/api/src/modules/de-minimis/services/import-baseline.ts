import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimis } from './import-de-minimis.js';

const EU = [
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

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

/**
 * Seed a minimal, conservative baseline of de minimis thresholds:
 * - US: DUTY $800 (intrinsic)
 * - EU members: DUTY €150 (intrinsic)
 * - GB: VAT £135 (intrinsic)
 *
 * Uses the importDeMinimis upsert for consistent behavior + provenance.
 */
export async function seedDeMinimisBaseline(
  on = new Date(),
  opts: { importId?: string } = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number; effectiveFrom: Date }> {
  const effectiveFrom = toMidnightUTC(on);

  const rows: DeMinimisInsert[] = [
    // US: Section 321 → intrinsic $800 (duty-side)
    {
      dest: 'US',
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'USD',
      value: '800',
      effectiveFrom,
      effectiveTo: null,
    },
    // GB: VAT up to £135 on intrinsic consignment value
    {
      dest: 'GB',
      deMinimisKind: 'VAT',
      deMinimisBasis: 'INTRINSIC',
      currency: 'GBP',
      value: '135',
      effectiveFrom,
      effectiveTo: null,
    },
    // EU members: duty-only €150 intrinsic
    ...EU.map<DeMinimisInsert>((cc) => ({
      dest: cc,
      deMinimisKind: 'DUTY',
      deMinimisBasis: 'INTRINSIC',
      currency: 'EUR',
      value: '150',
      effectiveFrom,
      effectiveTo: null,
    })),
  ];

  const res = await importDeMinimis(rows, {
    importId: opts.importId,
    makeSourceRef: (r) =>
      `baseline:dest=${r.dest}:kind=${r.deMinimisKind}:ef=${r.effectiveFrom.toISOString().slice(0, 10)}`,
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    effectiveFrom,
  };
}
