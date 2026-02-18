import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';
import * as XLSX from 'xlsx';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('../../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importMyMfnFromExcel } from './import-mfn-excel.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(rows: Array<Record<string, unknown>>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-my-mfn-'));
  const path = join(dir, 'fixture.xlsx');

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MFN');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  await writeFile(path, Buffer.from(buffer));
  fixtures.push({ dir, path });
  return path;
}

function makeRow(overrides: Partial<DutyRateInsert>): DutyRateInsert {
  return {
    dest: 'MY',
    partner: '',
    hs6: '850440',
    source: 'official',
    dutyRule: 'mfn',
    ratePct: '3.7',
    currency: undefined,
    notes: undefined,
    ...overrides,
  };
}

describe('importMyMfnFromExcel', () => {
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

  it('parses MFN ad-valorem rows and preserves note text', async () => {
    const path = await writeFixtureXlsx([
      { 'HS CODE': '85044090', 'RATE %': '3.7%', Remarks: 'ATIGA baseline' },
      { 'HS CODE': '85183000', 'RATE %': 'EXEMPT', Remarks: 'Duty free' },
      { 'HS CODE': '85291000', 'RATE %': 'RM 10/kg', Remarks: 'specific duty' },
      { 'HS CODE': 'nope', 'RATE %': '5%', Remarks: 'invalid hs' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importMyMfnFromExcel({
      url: path,
      importId: 'run_my_mfn_fixture',
      batchSize: 500,
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
    const [rows, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];

    expect(rows).toEqual([
      makeRow({ hs6: '850440', ratePct: '3.7', notes: 'ATIGA baseline' }),
      makeRow({ hs6: '851830', ratePct: '0', notes: 'Duty free' }),
    ]);
    expect(options).toMatchObject({
      importId: 'run_my_mfn_fixture',
      batchSize: 500,
      source: 'official',
    });
    expect(options.makeSourceRef(makeRow({ hs6: '850440' }))).toBe('my:excel/mfn:850440');
  });
});
