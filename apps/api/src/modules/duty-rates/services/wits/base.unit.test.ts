import { beforeEach, describe, expect, it, vi } from 'vitest';
import countries from 'i18n-iso-countries';
import {
  fetchSdmx,
  findSeriesDimIndex,
  flattenWitsSeries,
  jan1,
  toNumeric3String,
  toNumericReporterOrUnion,
  type SdmxJson,
} from './base.js';

const { state } = vi.hoisted(() => ({
  state: {
    queue: [] as Array<Response>,
    calls: [] as Array<{ url: string; init?: RequestInit }>,
  },
}));

vi.mock('../../../../lib/http.js', () => ({
  httpFetch: vi.fn(async (url: string, init?: RequestInit) => {
    state.calls.push({ url, init });
    const next = state.queue.shift();
    if (!next) throw new Error('No queued response for httpFetch');
    return next;
  }),
}));

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFlatJson(opts?: {
  tariffType?: 'MFN' | 'PREF';
  obsValue?: number;
  obsYear?: string;
  seriesKey?: string;
  productId?: string;
}): SdmxJson {
  const tariffType = opts?.tariffType ?? 'MFN';
  const obsValue = opts?.obsValue ?? 5;
  const obsYear = opts?.obsYear ?? '2024';
  const seriesKey = opts?.seriesKey ?? '0:0';
  const productId = opts?.productId ?? '010121';

  return {
    dataSets: [
      {
        series: {
          [seriesKey]: {
            observations: { '0': [obsValue] },
            attributes: [0],
          },
        },
      },
    ],
    structure: {
      dimensions: {
        series: [
          { id: 'PRODUCT', values: [{ id: productId, name: 'Some product' }] },
          { id: 'PARTNER', values: [{ id: '000', name: 'World' }] },
        ],
        observation: [{ id: 'TIME_PERIOD', values: [{ id: obsYear }] }],
      },
      attributes: {
        series: [{ id: 'TARIFFTYPE', values: [{ id: tariffType }] }],
      },
    },
  };
}

describe('wits/base helpers', () => {
  beforeEach(() => {
    state.queue = [];
    state.calls = [];
  });

  it('formats numeric percentages and guards invalid values', () => {
    expect(toNumeric3String(0)).toBe('0.000');
    expect(toNumeric3String(2.5)).toBe('2.500');
    expect(() => toNumeric3String(-1)).toThrow('invalid duty %');
    expect(() => toNumeric3String(Number.POSITIVE_INFINITY)).toThrow('invalid duty %');
  });

  it('builds Jan 1 UTC dates', () => {
    expect(jan1(2026).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('maps reporter tokens for EU, world, and ISO2 countries', () => {
    expect(toNumericReporterOrUnion('EU')).toEqual({ token: '918', display: 'EU' });
    expect(toNumericReporterOrUnion('all')).toEqual({ token: '000', display: 'WLD' });
    expect(toNumericReporterOrUnion('WLD')).toEqual({ token: '000', display: 'WLD' });
    expect(toNumericReporterOrUnion('US')).toEqual({ token: '840', display: 'US' });
    expect(() => toNumericReporterOrUnion('')).toThrow('empty reporter/partner');
    expect(() => toNumericReporterOrUnion('ZZ')).toThrow('unknown ISO2');
  });

  it('falls back to getNumericCodes when alpha3ToNumeric is unavailable', () => {
    const alpha3ToNumericOrig = (countries as any).alpha3ToNumeric;
    const getNumericCodesOrig = (countries as any).getNumericCodes;
    try {
      (countries as any).alpha3ToNumeric = undefined;
      (countries as any).getNumericCodes = () => ({ USA: '840' });
      expect(toNumericReporterOrUnion('US')).toEqual({ token: '840', display: 'US' });
    } finally {
      (countries as any).alpha3ToNumeric = alpha3ToNumericOrig;
      (countries as any).getNumericCodes = getNumericCodesOrig;
    }
  });

  it('throws when numeric reporter code cannot be resolved', () => {
    const alpha3ToNumericOrig = (countries as any).alpha3ToNumeric;
    const getNumericCodesOrig = (countries as any).getNumericCodes;
    try {
      (countries as any).alpha3ToNumeric = () => undefined;
      (countries as any).getNumericCodes = () => ({});
      expect(() => toNumericReporterOrUnion('US')).toThrow('no numeric code');
    } finally {
      (countries as any).alpha3ToNumeric = alpha3ToNumericOrig;
      (countries as any).getNumericCodes = getNumericCodesOrig;
    }
  });

  it('finds SDMX series dimensions by exact and includes matches', () => {
    const struct = {
      dimensions: {
        series: [
          { id: 'PRODUCT', values: [] },
          { id: 'REPORTER', values: [] },
          { id: 'PARTNER_AREA', values: [] },
        ],
        observation: [],
      },
    } as SdmxJson['structure'];

    expect(findSeriesDimIndex(struct, ['PRODUCT'])).toBe(0);
    expect(findSeriesDimIndex(struct, ['PARTNER'])).toBe(2);
    expect(() => findSeriesDimIndex(struct, ['FLOW'])).toThrow('SDMX: missing series dim');
  });
});

describe('fetchSdmx', () => {
  beforeEach(() => {
    state.queue = [];
    state.calls = [];
  });

  it('falls back to aveestimated when reported fails', async () => {
    const payload = makeFlatJson();
    state.queue.push(new Response('nope', { status: 503 }), jsonResp(payload));

    const out = await fetchSdmx('840', '000', 2024, 2024);

    expect(out).toEqual(payload);
    expect(state.calls).toHaveLength(2);
    expect(state.calls[0]?.url).toContain('.reported/?');
    expect(state.calls[1]?.url).toContain('.aveestimated/?');
  });

  it('returns null when both variants are empty/invalid', async () => {
    state.queue.push(
      new Response('not-json', { status: 200 }),
      jsonResp({
        dataSets: [{ series: {} }],
        structure: { dimensions: { series: [], observation: [] } },
      })
    );

    const out = await fetchSdmx('840', '124', 2024, 2024);
    expect(out).toBeNull();
  });

  it('uses reporter and partner tokens in query URL', async () => {
    state.queue.push(jsonResp(makeFlatJson()));
    await fetchSdmx('392', '918', 2020, 2021);
    const first = state.calls[0]?.url ?? '';
    expect(first).toContain('.392.918..reported/');
    expect(first).toContain('startperiod=2020');
    expect(first).toContain('endperiod=2021');
  });
});

describe('flattenWitsSeries', () => {
  it('maps MFN series to insert rows with empty partner', () => {
    const rows = flattenWitsSeries(makeFlatJson(), 'US', 2024, 'mfn', null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dest: 'US',
      partner: '',
      hs6: '010121',
      dutyRule: 'mfn',
      ratePct: '5.000',
    });
  });

  it('drops rows when tariff type does not match requested mode', () => {
    const rows = flattenWitsSeries(makeFlatJson({ tariffType: 'PREF' }), 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });

  it('supports literal HS extraction fallback and preferential rule mapping', () => {
    const json: SdmxJson = {
      dataSets: [
        {
          series: {
            '010121:abc': {
              observations: { '0': [7] },
            },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'DIM_A', values: [{ id: 'X', name: 'x' }] },
            { id: 'DIM_B', values: [{ id: 'Y', name: 'y' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    };

    const rows = flattenWitsSeries(json, 'US', 2024, 'prf', 'CA');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      hs6: '010121',
      partner: 'CA',
      dutyRule: 'fta',
      ratePct: '7.000',
    });
  });

  it('extracts HS6 from raw value name fallback and 8+ digit token slicing', () => {
    const json: SdmxJson = {
      dataSets: [
        {
          series: {
            // numeric token resolves by index->dim; value name contains HS6 for regex fallback
            '0:meta': { observations: { '0': [9] } },
            // literal token fallback with 8+ digits
            '01012199:meta': { observations: { '0': [3] } },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'PRODUCT', values: [{ id: 'X', name: 'HS 010121 live' }] },
            { id: 'META', values: [{ id: 'm', name: 'meta' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    };

    const rows = flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.map((r) => r.hs6)).toContain('010121');
  });

  it('uses tariff attribute name fallback when attribute id is missing', () => {
    const json = {
      dataSets: [
        {
          series: {
            '0:0': {
              observations: { '0': [5] },
              attributes: [0],
            },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'PRODUCT', values: [{ id: '010121', name: 'hs' }] },
            { id: 'PARTNER', values: [{ id: '124', name: 'Canada' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
        attributes: {
          series: [{ id: 'TARIFFTYPE', values: [{ name: 'PREF' }] }],
        },
      },
    } as any as SdmxJson;

    const rows = flattenWitsSeries(json, 'US', 2024, 'prf', 'CA');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dutyRule: 'fta', partner: 'CA' });
  });

  it('drops observations that do not match requested year', () => {
    const json = makeFlatJson({ obsYear: '2023' });
    const rows = flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });

  it('uses empty partner fallback for preferential rows when partner is null', () => {
    const rows = flattenWitsSeries(makeFlatJson({ tariffType: 'PREF' }), 'US', 2024, 'prf', null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dutyRule: 'fta', partner: '' });
  });

  it('drops rows when product index is out of range and no literal fallback exists', () => {
    const json: SdmxJson = {
      dataSets: [
        {
          series: {
            // first token treated as numeric index but points outside PRODUCT values
            '99:meta': { observations: { '0': [5] } },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'PRODUCT', values: [{ id: '010121', name: 'hs' }] },
            { id: 'META', values: [{ id: 'x', name: 'x' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    };

    const rows = flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });

  it('drops invalid/negative observation values', () => {
    const rows = flattenWitsSeries(makeFlatJson({ obsValue: -2 }), 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });

  it('drops entries with missing product token while preserving valid rows', () => {
    const json: SdmxJson = {
      dataSets: [
        {
          series: {
            'x:0': { observations: { '0': [4] } },
            x: { observations: { '0': [2] } },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'DIM_A', values: [{ id: '010121', name: 'hs' }] },
            { id: 'DIM_B', values: [{ id: '0', name: 'meta' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    };

    const rows = flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hs6).toBe('010121');
  });

  it('handles non-numeric product token fallback when autodetect picks PRODUCT-biased slot', () => {
    const json: SdmxJson = {
      dataSets: [
        {
          series: {
            'abc:def': { observations: { '0': [4] } },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'PRODUCT', values: [{ id: 'n/a', name: 'n/a' }] },
            { id: 'META', values: [{ id: 'x', name: 'x' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    };

    const rows = flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });

  it('covers debug logging branch controlled by WITS_LOG', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.WITS_LOG = '1';
    try {
      const rows = flattenWitsSeries(makeFlatJson(), 'US', 2024, 'mfn', null);
      expect(rows).toHaveLength(1);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      delete process.env.WITS_LOG;
      logSpy.mockRestore();
    }
  });
});
