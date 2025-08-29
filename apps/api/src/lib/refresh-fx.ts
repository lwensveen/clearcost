import { db, fxRatesTable } from '@clearcost/db';
import { XMLParser } from 'fast-xml-parser';

export type FxRefreshResult = { fxAsOf: string; inserted: number; base: 'EUR' };

export async function fetchEcbXml(): Promise<string> {
  const res = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {
    headers: {
      // ECB sometimes serves HTML when UA is weird; set a normal UA
      'user-agent': 'ClearCost/1.0 (+https://clearcost.dev)',
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'cache-control': 'no-cache',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ECB fetch failed: ${res.status} ${res.statusText} – ${body.slice(0, 200)}`);
  }
  return await res.text();
}

export function parseEcb(xml: string): { fxAsOf: string; rates: Record<string, number> } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    // default prefix is "@_"; we'll read attributes via that
  });

  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new Error(`ECB XML parse error: ${(e as Error).message}`);
  }

  // Shape is usually: gesmes:Envelope -> Cube -> Cube(time=YYYY-MM-DD) -> Cube(currency=..., rate=...)
  const daily = doc?.['gesmes:Envelope']?.Cube?.Cube;
  if (!daily || !daily['@_time']) {
    // helpful context
    throw new Error(`No date in ECB XML (unexpected shape). Snippet: ${xml.slice(0, 200)}...`);
  }

  const fxAsOf: string = daily['@_time'];
  const rates: Record<string, number> = {};

  const entries = Array.isArray(daily.Cube) ? daily.Cube : [];
  for (const c of entries) {
    const cur = c['@_currency'];
    const rate = c['@_rate'];
    if (cur && rate) rates[cur] = Number(rate);
  }

  rates['EUR'] = 1;
  return { fxAsOf, rates };
}

export async function upsertFxRatesEUR(
  fxAsOfIso: string,
  rates: Record<string, number>
): Promise<number> {
  const rows = Object.entries(rates)
    .filter(([c]) => c !== 'EUR')
    .map(([quote, rate]) => ({
      base: 'EUR' as const,
      quote,
      rate: String(rate),
      fxAsOf: new Date(fxAsOfIso + 'T00:00:00Z'),
    }));

  let inserted = 0;

  for (const row of rows) {
    await db
      .insert(fxRatesTable)
      .values(row)
      .onConflictDoNothing({
        target: [fxRatesTable.base, fxRatesTable.quote, fxRatesTable.fxAsOf],
      });

    inserted += 1;
  }

  return inserted;
}

export async function refreshFx(): Promise<FxRefreshResult> {
  const xml = await fetchEcbXml();
  const { fxAsOf, rates } = parseEcb(xml);
  const inserted = await upsertFxRatesEUR(fxAsOf, rates);
  return { fxAsOf, inserted, base: 'EUR' };
}
