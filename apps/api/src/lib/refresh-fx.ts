import { db, fxRatesTable, provenanceTable } from '@clearcost/db';
import { XMLParser } from 'fast-xml-parser';
import { httpFetch } from './http.js';
import { sha256Hex, startImportRun, finishImportRun } from './provenance.js';
import { resolveSourceDownloadUrl } from './source-registry.js';

export type FxRefreshResult = { fxAsOf: string; inserted: number; base: 'EUR' };
const ECB_DAILY_XML_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export async function fetchEcbXml(url = ECB_DAILY_XML_URL): Promise<string> {
  const res = await httpFetch(url, {
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

/** ECB daily XML parsed structure (via fast-xml-parser with attributes). */
interface EcbCubeEntry {
  '@_currency'?: string;
  '@_rate'?: string | number;
}

interface EcbDailyCube {
  '@_time'?: string;
  Cube?: EcbCubeEntry | EcbCubeEntry[];
}

interface EcbEnvelope {
  'gesmes:Envelope'?: {
    Cube?: {
      Cube?: EcbDailyCube;
    };
  };
}

export function parseEcb(xml: string): { fxAsOf: string; rates: Record<string, number> } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    // default prefix is "@_"; we'll read attributes via that
  });

  let doc: EcbEnvelope;
  try {
    doc = parser.parse(xml) as EcbEnvelope;
  } catch (e: unknown) {
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
  rates: Record<string, number>,
  opts?: { importId?: string }
): Promise<number> {
  const rows = Object.entries(rates)
    .filter(([c]) => c !== 'EUR')
    .map(([quote, rate]) => ({
      base: 'EUR' as const,
      quote,
      rate: String(rate),
      fxAsOf: new Date(fxAsOfIso + 'T00:00:00Z'),
    }));

  if (rows.length === 0) return 0;

  // Batch insert all FX rates in a single query
  const insertedRows = await db
    .insert(fxRatesTable)
    .values(rows)
    .onConflictDoNothing({
      target: [fxRatesTable.base, fxRatesTable.quote, fxRatesTable.fxAsOf],
    })
    .returning({ id: fxRatesTable.id });

  // Batch insert provenance rows for all successfully inserted rates
  if (opts?.importId && insertedRows.length > 0) {
    // Build a lookup from row index to the original row data.
    // insertedRows only contains rows that were actually inserted (not skipped
    // by onConflictDoNothing), so we pair each with the corresponding source
    // row using the order returned by the batch insert.
    const provenanceRows = insertedRows.map((ret, idx) => ({
      importId: opts.importId!,
      resourceType: 'fx_rate' as const,
      resourceId: ret.id,
      sourceKey: 'fx.ecb.daily',
      rowHash: sha256Hex(
        JSON.stringify({
          base: rows[idx]!.base,
          quote: rows[idx]!.quote,
          rate: rows[idx]!.rate,
          fxAsOf: rows[idx]!.fxAsOf.toISOString(),
        })
      ),
    }));

    try {
      await db.insert(provenanceTable).values(provenanceRows);
    } catch (e: unknown) {
      console.error('[FX] provenance batch insert failed (non-fatal)', {
        importId: opts.importId,
        resourceType: 'fx_rate',
        count: provenanceRows.length,
        error: (e as Error).message,
      });
    }
  }

  return insertedRows.length;
}

export async function refreshFx(): Promise<FxRefreshResult> {
  const sourceUrl = await resolveSourceDownloadUrl({
    sourceKey: 'fx.ecb.daily',
    fallbackUrl: ECB_DAILY_XML_URL,
  });

  const run = await startImportRun({
    importSource: 'ECB',
    job: 'fx:daily',
    sourceKey: 'fx.ecb.daily',
    sourceUrl,
  });

  try {
    const xml = await fetchEcbXml(sourceUrl);
    const { fxAsOf, rates } = parseEcb(xml);
    const inserted = await upsertFxRatesEUR(fxAsOf, rates, { importId: run.id });
    await finishImportRun(run.id, { importStatus: 'succeeded', inserted });
    return { fxAsOf, inserted, base: 'EUR' };
  } catch (err: unknown) {
    await finishImportRun(run.id, {
      importStatus: 'failed',
      error: (err as Error).message,
    });
    throw err;
  }
}
