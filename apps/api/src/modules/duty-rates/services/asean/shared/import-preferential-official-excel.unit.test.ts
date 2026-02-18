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

import { importAseanPreferentialOfficialFromExcel } from './import-preferential-official-excel.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(
  rows: Array<Record<string, unknown>>,
  sheetName = 'ATIGA'
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-vn-fta-official-'));
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
    dest: 'VN',
    partner: 'SG',
    hs6: '850440',
    source: 'official',
    dutyRule: 'fta',
    ratePct: '2.5',
    currency: undefined,
    notes: 'ATIGA',
    ...overrides,
  };
}

describe('importAseanPreferentialOfficialFromExcel', () => {
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

  it('parses partner-specific FTA rows from official sheets', async () => {
    const path = await writeFixtureXlsx([
      { 'HS CODE': '85044090', 'PREFERENTIAL RATE': '2.5%', PARTNER: 'Singapore' },
      { 'HS CODE': '85183000', 'PREFERENTIAL RATE': 'FREE', PARTNER: 'MY' },
      { 'HS CODE': '85291000', 'PREFERENTIAL RATE': '10 Dong/kg', PARTNER: 'Thailand' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importAseanPreferentialOfficialFromExcel({
      dest: 'VN',
      urlOrPath: path,
      agreement: 'ATIGA',
      importId: 'imp_vn_official_fta',
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      scanned: 3,
      kept: 2,
      skipped: 1,
    });

    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledTimes(1);
    const [rows, options] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];

    expect(rows).toEqual([
      makeRow({ hs6: '850440', partner: 'SG', ratePct: '2.5', notes: 'ATIGA' }),
      makeRow({ hs6: '851830', partner: 'MY', ratePct: '0', notes: 'ATIGA' }),
    ]);
    expect(options).toMatchObject({
      importId: 'imp_vn_official_fta',
      source: 'official',
    });
    expect(options.makeSourceRef(makeRow({ hs6: '850440', partner: 'SG' }))).toBe(
      'vn:atiga:SG:850440'
    );
  });

  it('uses explicit partner override when provided', async () => {
    const path = await writeFixtureXlsx(
      [{ 'HS CODE': '85044090', 'PREFERENTIAL RATE': '1.5%' }],
      'RCEP'
    );

    await importAseanPreferentialOfficialFromExcel({
      dest: 'ID',
      urlOrPath: path,
      partner: 'SG',
      agreement: 'RCEP',
      importId: 'imp_id_official_fta',
    });

    const [rows] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([
      expect.objectContaining({
        dest: 'ID',
        partner: 'SG',
        hs6: '850440',
        ratePct: '1.5',
      }),
    ]);
  });
});
