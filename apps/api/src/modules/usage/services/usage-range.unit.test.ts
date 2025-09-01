import { beforeEach, describe, expect, it, vi } from 'vitest';

const SUT = './usage-range.js';

async function importSut() {
  vi.resetModules();
  return (await import(SUT)) as {
    QueryRange: any;
    UsageResponseSchema: any;
    dayToUTC: (s: string) => Date;
    todayISO: () => string;
    normalizeRange: (from?: string, to?: string) => { fromDate: Date; toDate: Date };
    MAX_WINDOW_DAYS: number;
  };
}

describe('usage range schemas & helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-10T12:34:56.789Z'));
  });

  it('QueryRange validates YYYY-MM-DD strings and allows optional fields', async () => {
    const { QueryRange } = await importSut();

    expect(QueryRange.safeParse({ from: '2025-09-01', to: '2025-09-10' }).success).toBe(true);

    expect(QueryRange.safeParse({ from: '2025-01-01' }).success).toBe(true);

    expect(QueryRange.safeParse({ to: '2025-12-31' }).success).toBe(true);

    expect(QueryRange.safeParse({ from: '2025/09/01' }).success).toBe(false);
    expect(QueryRange.safeParse({ to: '2025-9-1' }).success).toBe(false);
    expect(QueryRange.safeParse({ from: 'nope' }).success).toBe(false);
    expect(QueryRange.safeParse({ from: 123 }).success).toBe(false);
  });

  it('UsageResponseSchema validates an array of rows (day can be Date)', async () => {
    const { UsageResponseSchema } = await importSut();

    const good = [
      {
        day: new Date('2025-09-01T00:00:00.000Z'),
        route: '/v1/things',
        method: 'GET',
        count: 10,
        sumDurationMs: 1234,
        sumBytesIn: 456,
        sumBytesOut: 789,
      },
    ];
    expect(UsageResponseSchema.safeParse(good).success).toBe(true);

    const bad = [
      {
        day: new Date(),
        route: '/v1/things',
        method: 42,
        count: 10,
        sumDurationMs: 1,
        sumBytesIn: 2,
        sumBytesOut: 3,
      },
    ];
    expect(UsageResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('dayToUTC makes a midnight-UTC Date from YYYY-MM-DD', async () => {
    const { dayToUTC } = await importSut();

    const d = dayToUTC('2025-01-02');
    expect(d.toISOString()).toBe('2025-01-02T00:00:00.000Z');

    expect(d.getTime()).toBe(Date.UTC(2025, 0, 2, 0, 0, 0, 0));
  });

  it('todayISO returns YYYY-MM-DD based on current (mocked) time in UTC', async () => {
    const { todayISO } = await importSut();

    expect(todayISO()).toBe('2025-09-10');
  });

  it('normalizeRange: defaults to [today-30d, today] at UTC midnight', async () => {
    const { normalizeRange } = await importSut();

    const { fromDate, toDate } = normalizeRange();
    expect(toDate.toISOString()).toBe('2025-09-10T00:00:00.000Z');
    expect(fromDate.toISOString()).toBe('2025-08-11T00:00:00.000Z');
  });

  it('normalizeRange: swaps inverted inputs (from > to)', async () => {
    const { normalizeRange } = await importSut();

    const { fromDate, toDate } = normalizeRange('2025-03-05', '2025-02-01');
    expect(fromDate.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    expect(toDate.toISOString()).toBe('2025-03-05T00:00:00.000Z');
  });

  it('normalizeRange: caps the window to MAX_WINDOW_DAYS', async () => {
    const { normalizeRange, MAX_WINDOW_DAYS } = await importSut();

    const { fromDate, toDate } = normalizeRange('2020-01-01', '2025-01-01');
    expect(toDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');

    const maxSpanMs = MAX_WINDOW_DAYS * 86400000;
    const expectedFrom = new Date(toDate.getTime() - maxSpanMs);
    expect(fromDate.getTime()).toBe(expectedFrom.getTime());
  });

  it('normalizeRange: respects single-ended defaults (only from or only to provided)', async () => {
    const { normalizeRange } = await importSut();

    {
      const { fromDate, toDate } = normalizeRange('2025-09-01');
      expect(fromDate.toISOString()).toBe('2025-09-01T00:00:00.000Z');
      expect(toDate.toISOString()).toBe('2025-09-10T00:00:00.000Z');
    }

    {
      const { fromDate, toDate } = normalizeRange(undefined, '2025-07-15');
      expect(fromDate.toISOString()).toBe('2025-07-15T00:00:00.000Z');
      expect(toDate.toISOString()).toBe('2025-08-11T00:00:00.000Z');
    }
  });
});
