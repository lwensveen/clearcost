import { db, deMinimisTable } from '@clearcost/db';
import { load } from 'cheerio';

type ParsedCell = { value: number; currency: string };
const URL = 'https://zonos.com/docs/guides/de-minimis-values';

const CURRENCY_FIX: Record<string, string> = { KM: 'BAM', RMB: 'CNY' };
const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

// Known basis overrides (authoritative sources):
const BASIS: Record<string, { duty?: 'INTRINSIC' | 'CIF'; vat?: 'INTRINSIC' | 'CIF' }> = {
  US: { duty: 'INTRINSIC' }, // Section 321 "fair retail value" (goods only)
  GB: { vat: 'INTRINSIC' }, // consignment intrinsic value up to £135
  // EU members: duty intrinsic €150
  AT: { duty: 'INTRINSIC' },
  BE: { duty: 'INTRINSIC' },
  BG: { duty: 'INTRINSIC' },
  HR: { duty: 'INTRINSIC' },
  CY: { duty: 'INTRINSIC' },
  CZ: { duty: 'INTRINSIC' },
  DE: { duty: 'INTRINSIC' },
  DK: { duty: 'INTRINSIC' },
  EE: { duty: 'INTRINSIC' },
  ES: { duty: 'INTRINSIC' },
  FI: { duty: 'INTRINSIC' },
  FR: { duty: 'INTRINSIC' },
  GR: { duty: 'INTRINSIC' },
  HU: { duty: 'INTRINSIC' },
  IE: { duty: 'INTRINSIC' },
  IT: { duty: 'INTRINSIC' },
  LT: { duty: 'INTRINSIC' },
  LU: { duty: 'INTRINSIC' },
  LV: { duty: 'INTRINSIC' },
  MT: { duty: 'INTRINSIC' },
  NL: { duty: 'INTRINSIC' },
  PL: { duty: 'INTRINSIC' },
  PT: { duty: 'INTRINSIC' },
  RO: { duty: 'INTRINSIC' },
  SE: { duty: 'INTRINSIC' },
  SI: { duty: 'INTRINSIC' },
  SK: { duty: 'INTRINSIC' },
};

function parseAmountCell(text: string): ParsedCell | null {
  const m = text
    .trim()
    .replace(/\s+/g, ' ')
    .match(/([\d.,]+)\s*([A-Za-z]{2,4})/);
  if (!m) return null;
  const value = Number(m[1]!.replace(/,/g, ''));
  const currencyRaw = m[2]!.toUpperCase();
  const currency = CURRENCY_FIX[currencyRaw] ?? currencyRaw;
  return { value, currency };
}

export async function importDeMinimisFromZonos(effectiveOn = new Date()) {
  const res = await fetch(URL, { headers: { 'user-agent': 'clearcost-seed/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} @ ${URL}`);
  const html = await res.text();
  const $ = load(html);

  const table = $('table')
    .filter((_i, t) => {
      const headers = $(t)
        .find('thead th')
        .map((_j, th) => $(th).text().trim())
        .get();
      return headers.length >= 4 && /country/i.test(headers[0]!) && /iso/i.test(headers[1]!);
    })
    .first();
  if (!table.length) throw new Error('Could not locate de minimis table');

  const effectiveFrom = toMidnightUTC(effectiveOn);

  await db.transaction(async (tx) => {
    for (const tr of table.find('tbody tr').toArray()) {
      const tds = $(tr)
        .find('td')
        .map((_j, td) => $(td).text().trim())
        .get();
      if (tds.length < 4) continue;

      const iso = tds[1]?.toUpperCase();
      if (!iso) continue;

      const duty = parseAmountCell(tds[2] ?? '');
      const tax = parseAmountCell(tds[3] ?? '');

      if (duty && duty.value > 0) {
        const basis = BASIS[iso]?.duty ?? 'INTRINSIC';
        await tx
          .insert(deMinimisTable)
          .values({
            dest: iso,
            deMinimisKind: 'DUTY',
            deMinimisBasis: basis,
            currency: duty.currency,
            value: String(duty.value),
            effectiveFrom,
            effectiveTo: null,
          })
          .onConflictDoUpdate({
            target: [
              deMinimisTable.dest,
              deMinimisTable.deMinimisKind,
              deMinimisTable.effectiveFrom,
            ],
            set: {
              deMinimisBasis: basis,
              currency: duty.currency,
              value: String(duty.value),
              updatedAt: new Date(),
            },
          });
      }

      if (tax && tax.value > 0) {
        const basis = BASIS[iso]?.vat ?? 'INTRINSIC';
        await tx
          .insert(deMinimisTable)
          .values({
            dest: iso,
            deMinimisKind: 'VAT',
            deMinimisBasis: basis,
            currency: tax.currency,
            value: String(tax.value),
            effectiveFrom,
            effectiveTo: null,
          })
          .onConflictDoUpdate({
            target: [
              deMinimisTable.dest,
              deMinimisTable.deMinimisKind,
              deMinimisTable.effectiveFrom,
            ],
            set: {
              deMinimisBasis: basis,
              currency: tax.currency,
              value: String(tax.value),
              updatedAt: new Date(),
            },
          });
      }
    }
  });

  return { ok: true, source: URL, effectiveFrom };
}
