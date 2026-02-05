import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    queue: [] as Array<unknown>,
  },
}));

vi.mock('@clearcost/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clearcost/db')>();
  return {
    ...actual,
    db: {
      ...actual.db,
      execute: vi.fn(async () => state.queue.shift() ?? { rows: [{ last_success_at: null }] }),
    },
  };
});

describe('getDatasetFreshnessSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-04T12:00:00.000Z'));
    state.queue = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns freshness for all datasets with threshold semantics', async () => {
    state.queue = [
      {
        rows: [
          {
            last_success_at: '2026-02-04T10:00:00.000Z',
            last_attempt_at: '2026-02-04T10:20:00.000Z',
            source: 'WITS',
          },
        ],
      }, // duties
      {
        rows: [
          {
            last_success_at: '2026-02-02T12:00:00.000Z',
            last_attempt_at: '2026-02-02T12:00:00.000Z',
            source: 'MANUAL',
          },
        ],
      }, // vat
      {
        rows: [
          {
            last_success_at: '2026-02-04T09:00:00.000Z',
            last_attempt_at: '2026-02-04T09:00:00.000Z',
            source: 'TRADE_GOV',
          },
        ],
      }, // de-minimis
      {
        rows: [
          {
            last_success_at: '2026-01-30T12:00:00.000Z',
            last_attempt_at: '2026-02-01T12:00:00.000Z',
            source: 'USITC',
          },
        ],
      }, // surcharges
      {
        rows: [
          {
            last_success_at: '2026-01-28T12:00:00.000Z',
            last_attempt_at: '2026-01-28T13:00:00.000Z',
            source: 'UK_TRADE',
          },
        ],
      }, // hs-aliases
      { rows: [{ last_success_at: null, last_attempt_at: null, source: null }] }, // freight
      {
        rows: [
          {
            last_success_at: '2026-02-04T11:30:00.000Z',
            last_attempt_at: '2026-02-04T11:30:00.000Z',
            source: 'ECB',
          },
        ],
      }, // fx
      {
        rows: [
          {
            last_success_at: '2026-02-03T12:00:00.000Z',
            last_attempt_at: '2026-02-03T14:00:00.000Z',
            source: 'CN_NOTICES',
          },
        ],
      }, // notices
    ];

    const { getDatasetFreshnessSnapshot } = await import('./services.js');
    const out = await getDatasetFreshnessSnapshot();

    expect(out.now.toISOString()).toBe('2026-02-04T12:00:00.000Z');
    expect(Object.keys(out.datasets)).toEqual([
      'duties',
      'vat',
      'de-minimis',
      'surcharges',
      'hs-aliases',
      'freight',
      'fx',
      'notices',
    ]);

    expect(out.datasets.duties.stale).toBe(false);
    expect(out.datasets.duties.lastSuccessAt?.toISOString()).toBe('2026-02-04T10:00:00.000Z');
    expect(out.datasets.duties.lastAttemptAt?.toISOString()).toBe('2026-02-04T10:20:00.000Z');
    expect(out.datasets.duties.source).toBe('WITS');
    expect(out.datasets.vat.stale).toBe(false);
    expect(out.datasets['de-minimis'].stale).toBe(false);
    expect(out.datasets.freight.stale).toBeNull();
    expect(out.datasets.freight.freshnessThresholdHours).toBeNull();
    expect(out.datasets.freight.lastSuccessAt).toBeNull();
    expect(out.datasets.fx.freshnessThresholdHours).toBe(30);
    expect(out.datasets.notices.stale).toBe(false);
  });
});
