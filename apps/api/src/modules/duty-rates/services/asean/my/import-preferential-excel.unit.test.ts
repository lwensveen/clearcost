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

import { importMyPreferentialFromExcel } from './import-preferential-excel.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(
  rows: Array<Record<string, unknown>>,
  sheetName: string
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-my-fta-'));
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
    dest: 'MY',
    partner: 'SG',
    hs6: '850440',
    source: 'official',
    dutyRule: 'fta',
    ratePct: '0',
    currency: undefined,
    notes: 'ATIGA',
    ...overrides,
  };
}

describe('importMyPreferentialFromExcel', () => {
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

  it('infers partner from sheet name and parses preferential ad-valorem rows', async () => {
    const path = await writeFixtureXlsx(
      [
        { 'HS CODE': '85044090', 'PREFERENTIAL RATE': '0%', NOTES: 'ATIGA' },
        { 'HS CODE': '85183000', 'PREFERENTIAL RATE': 'FREE', NOTES: 'ATIGA' },
        { 'HS CODE': '85291000', 'PREFERENTIAL RATE': 'RM 5/kg', NOTES: 'specific duty' },
      ],
      'Singapore'
    );

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importMyPreferentialFromExcel({
      url: path,
      sheet: 'Singapore',
      agreement: 'ATIGA',
      importId: 'run_my_fta_fixture',
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
      makeRow({ hs6: '850440', ratePct: '0', notes: 'ATIGA' }),
      makeRow({ hs6: '851830', ratePct: '0', notes: 'ATIGA' }),
    ]);
    expect(options).toMatchObject({
      importId: 'run_my_fta_fixture',
      source: 'official',
    });
    expect(options.makeSourceRef(makeRow({ hs6: '850440', partner: 'SG' }))).toBe(
      'my:atiga:SG:850440'
    );
  });

  it('prefers explicit partner override over sheet/row inference', async () => {
    const path = await writeFixtureXlsx(
      [{ 'HS CODE': '85044090', 'PREFERENTIAL RATE': '0%', 'PARTNER COUNTRY': 'Singapore' }],
      'Vietnam'
    );

    await importMyPreferentialFromExcel({
      url: path,
      sheet: 'Vietnam',
      partner: 'TH',
      agreement: 'ATIGA',
    });

    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([makeRow({ partner: 'TH', hs6: '850440', ratePct: '0', notes: 'ATIGA' })]);
  });
});
