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

import { importPhMfnExcel } from './import-mfn-excel.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(
  rows: Array<Record<string, unknown>>,
  sheetName = 'Sheet1'
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-ph-mfn-'));
  const path = join(dir, 'fixture.xlsx');

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
    dest: 'PH',
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

describe('importPhMfnExcel', () => {
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

  it('parses ad-valorem rows and skips specific/unreadable rows', async () => {
    const path = await writeFixtureXlsx([
      { 'ASEAN HSCODE': '85044090', 'MFN RATE': '3.7%' },
      { 'ASEAN HSCODE': '85183000', 'MFN RATE': 'FREE' },
      { 'ASEAN HSCODE': '85291000', 'MFN RATE': '10 RM/kg' },
      { 'ASEAN HSCODE': 'abc', 'MFN RATE': '4%' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importPhMfnExcel({
      urlOrPath: path,
      importId: 'run_ph_mfn_fixture',
      batchSize: 1000,
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      scanned: 4,
      kept: 2,
      skipped: 2,
    });

    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
    const [rows, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];

    expect(rows).toEqual([
      makeRow({ hs6: '850440', ratePct: '3.7' }),
      makeRow({ hs6: '851830', ratePct: '0' }),
    ]);
    expect(options).toMatchObject({
      importId: 'run_ph_mfn_fixture',
      batchSize: 1000,
      source: 'official',
    });
    expect(options.makeSourceRef(makeRow({ hs6: '850440' }))).toBe('ph:mfn:850440');
  });
});
