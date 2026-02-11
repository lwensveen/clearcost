import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
}));

vi.mock('@clearcost/db', async () => {
  const actual = await vi.importActual<typeof import('@clearcost/db')>('@clearcost/db');
  return {
    ...actual,
    db: {
      ...actual.db,
      select: mocks.selectMock,
    },
  };
});

import {
  getActiveDutyRateWithMeta,
  isGlobalPartnerRow,
  isPartnerCompatibleFallbackRow,
} from './get-active-duty-rate.js';

type SelectRow = {
  id: string;
  ratePct: number;
  dutyRule: 'mfn' | 'fta';
  partner: string;
  source: 'official' | 'manual' | 'vendor' | 'wits';
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

function queueSelectResults(...results: Array<unknown[]>) {
  let idx = 0;
  mocks.selectMock.mockImplementation(() => {
    const rows = results[idx++] ?? [];
    return {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => rows,
          }),
        }),
      }),
    };
  });
}

const ON = new Date('2025-02-01T00:00:00.000Z');

function dutyRow(input: Partial<SelectRow> = {}): SelectRow {
  return {
    id: input.id ?? 'row',
    ratePct: input.ratePct ?? 10,
    dutyRule: input.dutyRule ?? 'mfn',
    partner: input.partner ?? '',
    source: input.source ?? 'official',
    effectiveFrom: input.effectiveFrom ?? new Date('2024-01-01T00:00:00.000Z'),
    effectiveTo: input.effectiveTo ?? null,
  };
}

describe('partner-aware duty fallback lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('exposes partner compatibility helpers for safe fallback rules', () => {
    expect(isGlobalPartnerRow('')).toBe(true);
    expect(isGlobalPartnerRow('MX')).toBe(false);
    expect(isPartnerCompatibleFallbackRow('', 'CN')).toBe(true);
    expect(isPartnerCompatibleFallbackRow('CN', 'CN')).toBe(true);
    expect(isPartnerCompatibleFallbackRow('MX', 'CN')).toBe(false);
  });

  it('skips mismatched partner rows and falls back to global duty rows', async () => {
    const mismatched = dutyRow({ id: 'fta-mx', dutyRule: 'fta', partner: 'MX', ratePct: 0 });
    const global = dutyRow({ id: 'mfn-global', dutyRule: 'mfn', partner: '', ratePct: 6 });

    // select #1 exact-partner, #2 notes fallback, #3 general fallback
    queueSelectResults([], [], [mismatched, global]);

    const out = await getActiveDutyRateWithMeta('US', '010121', ON, { partner: 'CN' });
    expect(out.value?.id).toBe('mfn-global');
    expect(out.meta.status).toBe('ok');
    expect(out.meta.note).toBeUndefined();
  });

  it('returns no_match when only mismatched partner rows exist', async () => {
    const mismatched = dutyRow({ id: 'fta-mx', dutyRule: 'fta', partner: 'MX', ratePct: 0 });

    // select #1 exact-partner, #2 notes fallback, #3 general fallback, #4 dataset info
    queueSelectResults(
      [],
      [],
      [mismatched],
      [
        {
          dataset: 'official',
          effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]
    );

    const out = await getActiveDutyRateWithMeta('US', '010121', ON, { partner: 'CN' });
    expect(out.value).toBeNull();
    expect(out.meta.status).toBe('no_match');
    expect(out.meta.dataset).toBe('official');
  });

  it('only accepts partner-empty rows for notes fallback', async () => {
    const badNotes = dutyRow({ id: 'notes-mx', dutyRule: 'fta', partner: 'MX', ratePct: 0 });
    const goodNotes = dutyRow({ id: 'notes-global', dutyRule: 'fta', partner: '', ratePct: 2 });

    // select #1 exact-partner, #2 notes fallback candidates
    queueSelectResults([], [badNotes, goodNotes]);

    const out = await getActiveDutyRateWithMeta('US', '010121', ON, { partner: 'CN' });
    expect(out.value?.id).toBe('notes-global');
    expect(out.meta.note).toBe('partner_notes_fallback');
    expect(mocks.selectMock).toHaveBeenCalledTimes(2);
  });
});
