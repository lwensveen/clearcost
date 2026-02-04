import { afterEach, describe, expect, it, vi } from 'vitest';

type QItem = Response | Error;
const state = { queue: [] as QItem[], calls: [] as string[] };

async function importWithDebug() {
  vi.resetModules();
  vi.doMock('../../../../lib/http.js', () => ({
    httpFetch: vi.fn(async (url: string) => {
      state.calls.push(url);
      const next = state.queue.shift();
      if (!next) throw new Error('No queued response');
      if (next instanceof Error) throw next;
      return next;
    }),
  }));
  process.env.DEBUG = '1';
  return await import('./base.js');
}

afterEach(() => {
  delete process.env.DEBUG;
  state.queue = [];
  state.calls = [];
  vi.resetModules();
  vi.unmock('../../../../lib/http.js');
});

describe('wits/base debug branches', () => {
  it('logs debug branches in fetchSdmx', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    state.queue.push(
      new Response('fail', { status: 503, statusText: 'Bad Gateway' }),
      new Response('not-json', { status: 200 })
    );

    const mod = await importWithDebug();
    const out = await mod.fetchSdmx('840', '000', 2024, 2024);

    expect(out).toBeNull();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs autodetect and summary debug branches in flattenWitsSeries', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await importWithDebug();

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
            { id: 'PARTNER', values: [{ id: '000', name: 'world' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
        attributes: {
          series: [{ id: 'TARIFFTYPE', values: [{ id: 'MFN' }] }],
        },
      },
    } as any;

    const out = mod.flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(out).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs literal-only mapping branch when PRODUCT autodetect score is zero', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await importWithDebug();

    const json = {
      dataSets: [
        {
          series: {
            'abc:def': {
              observations: { '0': [5] },
            },
          },
        },
      ],
      structure: {
        dimensions: {
          series: [
            { id: 'DIM_A', values: [{ id: 'x', name: 'x' }] },
            { id: 'DIM_B', values: [{ id: 'y', name: 'y' }] },
          ],
          observation: [{ id: 'TIME_PERIOD', values: [{ id: '2024' }] }],
        },
      },
    } as any;

    const out = mod.flattenWitsSeries(json, 'US', 2024, 'mfn', null);
    expect(out).toEqual([]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
