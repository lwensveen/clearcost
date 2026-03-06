import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fx from '../refresh-fx.js';
import { resolveSourceDownloadUrl } from '../source-registry.js';

const { calls, provCalls } = vi.hoisted(() => ({
  calls: [] as any[],
  provCalls: [] as any[],
}));

vi.mock('@clearcost/db', () => {
  const fxRatesTable = {
    id: { name: 'id' },
    base: { name: 'base' },
    quote: { name: 'quote' },
    fxAsOf: { name: 'fxAsOf' },
  } as const;

  const provenanceTable = { __marker: 'provenance' } as const;

  const db = {
    insert: (tbl: any) => {
      if (tbl === provenanceTable) {
        return {
          values: (vals: any) => {
            provCalls.push(vals);
            return Promise.resolve();
          },
        };
      }
      return {
        values: (vals: any) => ({
          onConflictDoNothing: (args: any) => ({
            returning: async () => {
              calls.push({ tbl, vals, args });
              // vals is now an array of all rows (bulk insert)
              const rows = Array.isArray(vals) ? vals : [vals];
              return rows.map((r: any) => ({ id: `fx_${r.quote}_id` }));
            },
          }),
        }),
      };
    },
  };

  return { db, fxRatesTable, provenanceTable, __calls: calls };
});

vi.mock('../provenance.js', () => ({
  sha256Hex: vi.fn((s: string) => `sha256_${s.slice(0, 20)}`),
  startImportRun: vi.fn(async () => ({ id: 'import_run_123' })),
  finishImportRun: vi.fn(async () => ({})),
}));

vi.mock('../source-registry.js', () => ({
  resolveSourceDownloadUrl: vi.fn(async ({ fallbackUrl }: { fallbackUrl?: string }) => fallbackUrl),
}));

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time="2025-08-31">
      <Cube currency="USD" rate="1.2345"/>
      <Cube currency="JPY" rate="160.12"/>
    </Cube>
  </Cube>
</gesmes:Envelope>
`;

describe('parseEcb', () => {
  it('extracts fxAsOf and currency rates; adds EUR=1', () => {
    const out = fx.parseEcb(SAMPLE_XML);
    expect(out.fxAsOf).toBe('2025-08-31');
    expect(out.rates).toMatchObject({ USD: 1.2345, JPY: 160.12, EUR: 1 });
  });

  it('throws on malformed XML', () => {
    expect(() => fx.parseEcb('<not-xml')).toThrow(/ECB XML parse error/i);
  });

  it('throws when date/time attribute missing', () => {
    const bad = `<?xml version="1.0"?><gesmes:Envelope><Cube><Cube><Cube currency="USD" rate="1.0"/></Cube></Cube></gesmes:Envelope>`;
    expect(() => fx.parseEcb(bad)).toThrow(/No date in ECB XML/i);
  });
});

describe('upsertFxRatesEUR', () => {
  beforeEach(() => {
    calls.length = 0;
    provCalls.length = 0;
  });

  it('inserts one row per non-EUR quote with correct values and conflict target', async () => {
    const inserted = await fx.upsertFxRatesEUR('2025-08-31', { USD: 1.1, JPY: 160, EUR: 1 });
    expect(inserted).toBe(2);
    // Bulk insert: single call with an array of all rows
    expect(calls.length).toBe(1);

    const c = calls[0]!;
    expect(Array.isArray(c.args.target)).toBe(true);
    expect(c.args.target.map((t: any) => t.name)).toEqual(['base', 'quote', 'fxAsOf']);
    expect(Array.isArray(c.vals)).toBe(true);
    expect(c.vals.length).toBe(2);

    for (const row of c.vals) {
      expect(row.base).toBe('EUR');
      expect(typeof row.quote).toBe('string');
      expect(typeof row.rate).toBe('string');
      expect(new Date(row.fxAsOf).toISOString()).toBe('2025-08-31T00:00:00.000Z');
    }

    const quotes = c.vals.map((r: any) => r.quote).sort();
    expect(quotes).toEqual(['JPY', 'USD']);
  });

  it('writes provenance rows when importId is provided', async () => {
    await fx.upsertFxRatesEUR(
      '2025-08-31',
      { USD: 1.1, JPY: 160, EUR: 1 },
      {
        importId: 'test_import_id',
      }
    );

    // Provenance is now a single batch insert with an array of rows
    expect(provCalls.length).toBe(1);
    const provRows = provCalls[0]!;
    expect(Array.isArray(provRows)).toBe(true);
    expect(provRows.length).toBe(2);
    for (const p of provRows) {
      expect(p.importId).toBe('test_import_id');
      expect(p.resourceType).toBe('fx_rate');
      expect(p.sourceKey).toBe('fx.ecb.daily');
      expect(typeof p.rowHash).toBe('string');
    }
  });

  it('skips provenance when no importId provided', async () => {
    await fx.upsertFxRatesEUR('2025-08-31', { USD: 1.1, EUR: 1 });
    expect(provCalls.length).toBe(0);
  });
});

describe('fetchEcbXml', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('performs a GET with expected headers and returns body text', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '<xml/>' }));
    vi.stubGlobal('fetch', fetchMock);

    const xml = await fx.fetchEcbXml();
    expect(xml).toBe('<xml/>');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts]: any = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('eurofxref-daily.xml');
    expect(opts?.headers?.['user-agent']).toMatch(/ClearCost/i);
    expect(opts?.headers?.accept).toMatch(/xml/);
  });

  it('accepts an explicit URL override', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '<xml/>' }));
    vi.stubGlobal('fetch', fetchMock);

    await fx.fetchEcbXml('https://example.test/fx.xml');
    const [url]: any = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/fx.xml');
  });

  it('throws a helpful error when response is not ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'upstream down',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fx.fetchEcbXml()).rejects.toThrow(/ECB fetch failed: 502 Bad Gateway/i);
  });
});

describe('refreshFx (integration of parse + upsert)', () => {
  beforeEach(() => {
    calls.length = 0;
    provCalls.length = 0;
  });

  it('fetches, parses, upserts with provenance, and returns summary', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => SAMPLE_XML }));
    vi.stubGlobal('fetch', fetchMock);

    const { startImportRun, finishImportRun } = await import('../provenance.js');

    const res = await fx.refreshFx();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'fx.ecb.daily',
      fallbackUrl: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    });

    expect(res).toEqual({ fxAsOf: '2025-08-31', inserted: 2, base: 'EUR' });
    expect(calls.length).toBe(1);
    expect(provCalls.length).toBe(1);

    expect(startImportRun).toHaveBeenCalledWith(
      expect.objectContaining({
        importSource: 'ECB',
        job: 'fx:daily',
        sourceKey: 'fx.ecb.daily',
      })
    );
    expect(finishImportRun).toHaveBeenCalledWith('import_run_123', {
      importStatus: 'succeeded',
      inserted: 2,
    });

    vi.unstubAllGlobals();
  });

  it('finishes import run as failed on error', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'boom',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { finishImportRun } = await import('../provenance.js');

    await expect(fx.refreshFx()).rejects.toThrow(/ECB fetch failed/);

    expect(finishImportRun).toHaveBeenCalledWith('import_run_123', {
      importStatus: 'failed',
      error: expect.stringContaining('ECB fetch failed'),
    });

    vi.unstubAllGlobals();
  });
});
