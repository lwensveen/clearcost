import { db, fxRatesTable } from '@clearcost/db';

export type FxRefreshResult = { asOf: string; inserted: number; base: 'EUR' };

export async function fetchEcbXml(): Promise<string> {
  const res = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
  if (!res.ok) throw new Error(`ECB fetch failed: ${res.status}`);
  return await res.text();
}

export function parseEcb(xml: string): { asOf: string; rates: Record<string, number> } {
  const dateMatch = xml.match(/time="(\d{4}-\d{2}-\d{2})"/);
  if (!dateMatch) throw new Error('No date in ECB XML');
  const asOf = dateMatch[1]!;

  const rates: Record<string, number> = {};

  for (const m of xml.matchAll(/currency="([A-Z]{3})"\s+rate="([\d.]+)"/g)) {
    rates[m[1]!] = Number(m[2]);
  }
  rates['EUR'] = 1;
  return { asOf, rates };
}

export async function upsertFxRatesEUR(
  asOfIso: string,
  rates: Record<string, number>
): Promise<number> {
  const rows = Object.entries(rates)
    .filter(([c]) => c !== 'EUR')
    .map(([quote, rate]) => ({
      base: 'EUR' as const,
      quote,
      rate: String(rate),
      asOf: new Date(asOfIso + 'T00:00:00Z'),
    }));

  let inserted = 0;

  for (const row of rows) {
    const res = await db
      .insert(fxRatesTable)
      .values(row)
      .onConflictDoNothing({ target: [fxRatesTable.base, fxRatesTable.quote, fxRatesTable.asOf] });

    inserted += 1;
  }

  return inserted;
}

export async function refreshFx(): Promise<FxRefreshResult> {
  const xml = await fetchEcbXml();
  const { asOf, rates } = parseEcb(xml);
  const inserted = await upsertFxRatesEUR(asOf, rates);
  return { asOf, inserted, base: 'EUR' };
}
