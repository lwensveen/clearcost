import { db, deMinimisTable, provenanceTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { load } from 'cheerio';
import { sha256Hex } from '../../../lib/provenance.js';
import { httpFetch } from '../../../lib/http.js';
import type { DeMinimisInsert } from '@clearcost/types';
import { resolveZonosDeMinimisUrl } from './source-urls.js';

type ParsedCell = { value: number; currency: string };
type DeMinimisBasis = NonNullable<DeMinimisInsert['deMinimisBasis']>;
const ZONOS_SOURCE_KEY = 'de-minimis.zonos.docs';

const CURRENCY_FIX: Record<string, string> = { KM: 'BAM', RMB: 'CNY' };
const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

const EU_DUTY_INTRINSIC = new Set([
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
]);
const BASIS_OVERRIDES: Partial<
  Record<string, Partial<Record<DeMinimisInsert['deMinimisKind'], DeMinimisBasis>>>
> = {
  US: { DUTY: 'INTRINSIC' },
  GB: { VAT: 'INTRINSIC' },
  CA: { DUTY: 'INTRINSIC', VAT: 'INTRINSIC' },
};

export function resolveZonosBasis(
  dest: string,
  kind: DeMinimisInsert['deMinimisKind']
): DeMinimisBasis {
  const country = String(dest).trim().toUpperCase();
  const override = BASIS_OVERRIDES[country]?.[kind];
  if (override) return override;
  if (kind === 'DUTY' && EU_DUTY_INTRINSIC.has(country)) return 'INTRINSIC';
  // Conservative default for scraped source when no explicit jurisdiction basis is configured.
  return 'CIF';
}

function parseAmountCell(text: string): ParsedCell | null {
  // expects formats like "150 EUR", "€150 EUR", "150USD" (we only use trailing currency letters)
  const m = text
    .trim()
    .replace(/\s+/g, ' ')
    .match(/([\d.,]+)\s*([A-Za-z]{2,4})/);
  if (!m) return null;
  const value = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const currencyRaw = m[2]!.toUpperCase();
  const currency = CURRENCY_FIX[currencyRaw] ?? currencyRaw;
  return { value, currency };
}

export async function importDeMinimisFromZonos(
  effectiveOn = new Date(),
  opts: { importId?: string; skipUS?: boolean; sourceUrl?: string } = {}
) {
  const sourceUrl = await resolveZonosDeMinimisUrl(opts.sourceUrl);
  const res = await httpFetch(sourceUrl, { headers: { 'user-agent': 'clearcost-seed/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} @ ${sourceUrl}`);
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

  let inserted = 0;
  let updated = 0;

  const provBatch: Array<{
    importId: string;
    resourceType: 'de_minimis';
    resourceId: string;
    sourceKey: string;
    sourceRef: string;
    sourceHash: string;
    rowHash: string;
  }> = [];

  await db.transaction(async (tx) => {
    for (const tr of table.find('tbody tr').toArray()) {
      const tds = $(tr)
        .find('td')
        .map((_j, td) => $(td).text().trim())
        .get();
      if (tds.length < 4) continue;

      const iso = tds[1]?.toUpperCase();
      if (!iso) continue;
      if (opts.skipUS && iso === 'US') continue;

      const duty = parseAmountCell(tds[2] ?? '');
      const tax = parseAmountCell(tds[3] ?? '');

      // helper to upsert one row and tally provenance
      const upsertOne = async (
        kind: 'DUTY' | 'VAT',
        value: number,
        currency: string,
        basis: 'INTRINSIC' | 'CIF'
      ) => {
        const ret = await tx
          .insert(deMinimisTable)
          .values({
            dest: iso,
            deMinimisKind: kind,
            deMinimisBasis: basis,
            currency,
            value: value.toFixed(2),
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
              currency,
              value: value.toFixed(2),
              updatedAt: new Date(),
            },
          })
          .returning({
            id: deMinimisTable.id,
            inserted: sql<number>`(xmax = 0)::int`,
          });

        const row = ret[0];
        if (!row) return;
        if (row.inserted === 1) inserted++;
        else updated++;

        if (opts.importId) {
          const sourceRef = `zonos:de-minimis:${iso}:${kind}:${effectiveFrom
            .toISOString()
            .slice(0, 10)}`;
          const sourceHash = sha256Hex(sourceRef);
          const rowHash = sha256Hex(
            JSON.stringify({
              dest: iso,
              kind,
              basis,
              currency,
              value: value.toFixed(2),
              ef: effectiveFrom.toISOString(),
              et: null,
            })
          );
          provBatch.push({
            importId: opts.importId,
            resourceType: 'de_minimis',
            resourceId: row.id,
            sourceKey: ZONOS_SOURCE_KEY,
            sourceRef,
            sourceHash,
            rowHash,
          });
        }
      };

      if (duty && duty.value > 0) {
        await upsertOne('DUTY', duty.value, duty.currency, resolveZonosBasis(iso, 'DUTY'));
      }
      if (tax && tax.value > 0) {
        await upsertOne('VAT', tax.value, tax.currency, resolveZonosBasis(iso, 'VAT'));
      }
    }

    if (opts.importId && provBatch.length) {
      await tx.insert(provenanceTable).values(provBatch);
    }
  });

  if (inserted + updated === 0) {
    throw new Error(
      '[De Minimis Zonos] source produced 0 rows. Check page structure and parsing selectors.'
    );
  }

  return {
    ok: true as const,
    source: sourceUrl,
    effectiveFrom,
    inserted,
    updated,
    count: inserted + updated,
  };
}
