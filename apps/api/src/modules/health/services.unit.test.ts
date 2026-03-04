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

describe('getSourceRegistrySnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-04T12:00:00.000Z'));
    state.queue = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sources with staleness computed from sla_max_age_hours', async () => {
    state.queue = [
      {
        rows: [
          {
            key: 'duties.eu.taric',
            dataset: 'duties',
            source_type: 'api',
            enabled: true,
            schedule_hint: 'daily',
            sla_max_age_hours: 48,
            last_verified_at: '2026-01-20T00:00:00.000Z',
            last_import_id: 'imp_1',
            last_import_status: 'succeeded',
            last_import_job: 'duties:eu-mfn-official',
            last_import_at: '2026-02-04T10:00:00.000Z',
            last_import_inserted: 1500,
            last_import_error: null,
          },
          {
            key: 'fx.ecb.daily',
            dataset: 'fx',
            source_type: 'api',
            enabled: true,
            schedule_hint: 'daily',
            sla_max_age_hours: 30,
            last_verified_at: null,
            last_import_id: null,
            last_import_status: null,
            last_import_job: null,
            last_import_at: null,
            last_import_inserted: null,
            last_import_error: null,
          },
          {
            key: 'vat.oecd',
            dataset: 'vat',
            source_type: 'file',
            enabled: false,
            schedule_hint: 'manual',
            sla_max_age_hours: null,
            last_verified_at: null,
            last_import_id: 'imp_3',
            last_import_status: 'succeeded',
            last_import_job: 'vat:auto',
            last_import_at: '2026-02-01T08:00:00.000Z',
            last_import_inserted: 30,
            last_import_error: null,
          },
        ],
      },
    ];

    const { getSourceRegistrySnapshot } = await import('./services.js');
    const out = await getSourceRegistrySnapshot();

    expect(out.now.toISOString()).toBe('2026-02-04T12:00:00.000Z');
    expect(out.sources).toHaveLength(3);

    // duties.eu.taric — 2h old, SLA 48h → not stale
    const duties = out.sources[0]!;
    expect(duties.key).toBe('duties.eu.taric');
    expect(duties.stale).toBe(false);
    expect(duties.lastImport).not.toBeNull();
    expect(duties.lastImport!.id).toBe('imp_1');
    expect(duties.lastImport!.inserted).toBe(1500);

    // fx.ecb.daily — no import yet, SLA 30h → stale
    const fx = out.sources[1]!;
    expect(fx.key).toBe('fx.ecb.daily');
    expect(fx.stale).toBe(true);
    expect(fx.lastImport).toBeNull();
    expect(fx.ageHours).toBeNull();

    // vat.oecd — no SLA → stale=null
    const vat = out.sources[2]!;
    expect(vat.key).toBe('vat.oecd');
    expect(vat.stale).toBeNull();
    expect(vat.enabled).toBe(false);
    expect(vat.lastImport!.job).toBe('vat:auto');
  });

  it('returns empty sources array when registry is empty', async () => {
    state.queue = [{ rows: [] }];

    const { getSourceRegistrySnapshot } = await import('./services.js');
    const out = await getSourceRegistrySnapshot();

    expect(out.sources).toEqual([]);
  });
});

describe('getMvpFreshnessSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-04T12:00:00.000Z'));
    state.queue = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks official MVP import jobs for fx/vat/eu duties freshness', async () => {
    state.queue = [
      {
        rows: [
          {
            last_success_at: '2026-02-04T11:30:00.000Z',
            last_attempt_at: '2026-02-04T11:30:00.000Z',
            source: 'ECB',
          },
        ],
      }, // fx:daily
      {
        rows: [
          {
            last_success_at: '2026-02-04T10:00:00.000Z',
            last_attempt_at: '2026-02-04T10:00:00.000Z',
            source: 'OECD/IMF',
          },
        ],
      }, // vat:auto
      {
        rows: [
          {
            last_success_at: '2026-02-04T09:00:00.000Z',
            last_attempt_at: '2026-02-04T09:10:00.000Z',
            source: 'TARIC',
          },
        ],
      }, // duties:eu-mfn-official|duties:eu-daily-official
    ];

    const { getMvpFreshnessSnapshot } = await import('./services.js');
    const out = await getMvpFreshnessSnapshot();

    expect(out.now.toISOString()).toBe('2026-02-04T12:00:00.000Z');
    expect(Object.keys(out.datasets)).toEqual(['fx', 'vat', 'duties']);
    expect(out.datasets.fx.stale).toBe(false);
    expect(out.datasets.fx.source).toBe('ECB');
    expect(out.datasets.vat.stale).toBe(false);
    expect(out.datasets.vat.source).toBe('OECD/IMF');
    expect(out.datasets.duties.stale).toBe(false);
    expect(out.datasets.duties.source).toBe('TARIC');
  });
});
