import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';

const mocks = vi.hoisted(() => ({
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importTrMfnOfficial } from './import-mfn-official.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(rows: Array<Record<string, unknown>>, sheetName = 'Tariff') {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-tr-mfn-official-'));
  const path = join(dir, 'turkey-tariff.xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  await writeFile(path, Buffer.from(buffer));
  fixtures.push({ dir, path });
  return path;
}

function makeRow(overrides: Partial<DutyRateInsert>): DutyRateInsert {
  return {
    dest: 'TR',
    partner: '',
    hs6: '850440',
    source: 'official',
    dutyRule: 'mfn',
    ratePct: '5',
    currency: undefined,
    notes: 'Turkey customs tariff MFN (official)',
    ...overrides,
  };
}

describe('importTrMfnOfficial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 0,
      updated: 0,
      count: 0,
      dryRun: false,
    });
  });

  afterEach(async () => {
    await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture.dir, { recursive: true })));
  });

  it('parses HS6 + ad-valorem MFN rates and skips non-ad-valorem rows', async () => {
    const path = await writeFixtureXlsx([
      { 'Tariff Item': '85044010', 'MFN Rate': '5%' },
      { 'Tariff Item': '85183000', 'MFN Rate': 'Free' },
      { 'Tariff Item': '85291000', 'MFN Rate': '10 EUR/kg' },
      { 'Tariff Item': 'abc', 'MFN Rate': '4%' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importTrMfnOfficial({
      urlOrPath: path,
      importId: 'imp_tr_mfn',
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      scanned: 4,
      kept: 2,
      skipped: 2,
      sourceFile: 'turkey-tariff.xlsx',
    });

    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
    const [rows, opts] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([
      makeRow({ hs6: '850440', ratePct: '5' }),
      makeRow({ hs6: '851830', ratePct: '0' }),
    ]);
    expect(opts).toMatchObject({
      importId: 'imp_tr_mfn',
      source: 'official',
    });
    expect(opts.makeSourceRef(makeRow({ hs6: '850440' }))).toBe('tr:mfn:850440');
  });
});
