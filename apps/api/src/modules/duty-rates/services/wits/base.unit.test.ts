import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(toNumericReporterOrUnion('WLD')).toEqual({ token: '000', display: 'WLD' });
    expect(toNumericReporterOrUnion('US')).toEqual({ token: '840', display: 'US' });
    expect(() => toNumericReporterOrUnion('ZZ')).toThrow('unknown ISO2');
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

  it('drops invalid/negative observation values', () => {
    const rows = flattenWitsSeries(makeFlatJson({ obsValue: -2 }), 'US', 2024, 'mfn', null);
    expect(rows).toEqual([]);
  });
});
