import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fx from '../refresh-fx.js';
import { resolveSourceDownloadUrl } from '../source-registry.js';

const { calls } = vi.hoisted(() => ({ calls: [] as any[] }));

vi.mock('@clearcost/db', () => {
  const fxRatesTable = {
    base: { name: 'base' },
    quote: { name: 'quote' },
    fxAsOf: { name: 'fxAsOf' },
  } as const;

  const db = {
    insert: (tbl: any) => ({
      values: (vals: any) => ({
        onConflictDoNothing: async (args: any) => {
          calls.push({ tbl, vals, args });
        },
      }),
    }),
  };

  return { db, fxRatesTable, __calls: calls };
});

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
  });

  it('inserts one row per non-EUR quote with correct values and conflict target', async () => {
    const inserted = await fx.upsertFxRatesEUR('2025-08-31', { USD: 1.1, JPY: 160, EUR: 1 });
    expect(inserted).toBe(2);
    expect(calls.length).toBe(2);

    for (const c of calls) {
      // target composite key
      expect(Array.isArray(c.args.target)).toBe(true);
      expect(c.args.target.map((t: any) => t.name)).toEqual(['base', 'quote', 'fxAsOf']);

      // row shape
      expect(c.vals.base).toBe('EUR');
      expect(typeof c.vals.quote).toBe('string');
      expect(typeof c.vals.rate).toBe('string'); // stored as string
      expect(new Date(c.vals.fxAsOf).toISOString()).toBe('2025-08-31T00:00:00.000Z');
    }

    // Specific rows captured
    const quotes = calls.map((c) => c.vals.quote).sort();
    expect(quotes).toEqual(['JPY', 'USD']);
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
  });

  it('fetches, parses, upserts, and returns summary', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => SAMPLE_XML }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fx.refreshFx();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolveSourceDownloadUrl).toHaveBeenCalledWith({
      sourceKey: 'fx.ecb.daily',
      fallbackUrl: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    });

    expect(res).toEqual({ fxAsOf: '2025-08-31', inserted: 2, base: 'EUR' });
    expect(calls.length).toBe(2); // USD + JPY rows

    vi.unstubAllGlobals();
  });
});
