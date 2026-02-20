import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSourceRegistryByKey, resolveSourceDownloadUrl } from '../source-registry.js';

const { state } = vi.hoisted(() => ({
  state: {
    rows: [] as Array<{
      key: string;
      enabled: boolean;
      baseUrl: string | null;
      downloadUrlTemplate: string | null;
    }>,
    error: null as Error | null,
    where: null as unknown,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
}));

vi.mock('@clearcost/db', () => {
  const sourceRegistryTable = {
    key: 'key',
    enabled: 'enabled',
    baseUrl: 'baseUrl',
    downloadUrlTemplate: 'downloadUrlTemplate',
  } as const;

  const db = {
    select: () => ({
      from: () => ({
        where: (predicate: unknown) => ({
          limit: async () => {
            state.where = predicate;
            if (state.error) throw state.error;
            return state.rows;
          },
        }),
      }),
    }),
  };

  return { db, sourceRegistryTable };
});

describe('source registry resolver', () => {
  beforeEach(() => {
    state.rows = [];
    state.error = null;
    state.where = null;
  });

  it('returns a source row by key', async () => {
    state.rows = [
      {
        key: 'fx.ecb.daily',
        enabled: true,
        baseUrl: 'https://www.ecb.europa.eu',
        downloadUrlTemplate: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
      },
    ];

    const out = await getSourceRegistryByKey('fx.ecb.daily');
    expect(out?.key).toBe('fx.ecb.daily');
    expect(state.where).toMatchObject({ op: 'eq', left: 'key', right: 'fx.ecb.daily' });
  });

  it('prefers downloadUrlTemplate when enabled', async () => {
    state.rows = [
      {
        key: 'vat.oecd_imf.standard',
        enabled: true,
        baseUrl: 'https://www.oecd.org',
        downloadUrlTemplate:
          'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx',
      },
    ];

    const out = await resolveSourceDownloadUrl({
      sourceKey: 'vat.oecd_imf.standard',
      fallbackUrl: 'https://fallback.test/vat.xlsx',
    });

    expect(out).toContain('vat-gst-rates-ctt-trends.xlsx');
  });

  it('falls back when source key is missing', async () => {
    const out = await resolveSourceDownloadUrl({
      sourceKey: 'unknown.source',
      fallbackUrl: 'https://fallback.test/data.xml',
    });

    expect(out).toBe('https://fallback.test/data.xml');
  });

  it('throws when source exists but is disabled', async () => {
    state.rows = [
      {
        key: 'fx.ecb.daily',
        enabled: false,
        baseUrl: 'https://www.ecb.europa.eu',
        downloadUrlTemplate: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
      },
    ];

    await expect(
      resolveSourceDownloadUrl({
        sourceKey: 'fx.ecb.daily',
        fallbackUrl: 'https://fallback.test/fx.xml',
      })
    ).rejects.toThrow(/disabled/i);
  });

  it('falls back when source_registry table does not exist yet', async () => {
    const err = new Error('relation "source_registry" does not exist');
    (err as Error & { code?: string }).code = '42P01';
    state.error = err;

    const out = await resolveSourceDownloadUrl({
      sourceKey: 'fx.ecb.daily',
      fallbackUrl: 'https://fallback.test/fx.xml',
    });

    expect(out).toBe('https://fallback.test/fx.xml');
  });
});
