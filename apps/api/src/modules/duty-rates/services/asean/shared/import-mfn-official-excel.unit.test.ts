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

import { importAseanMfnOfficialFromExcel } from './import-mfn-official-excel.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

async function writeFixtureXlsx(
  rows: Array<Record<string, unknown>>,
  sheetName = 'Tariff'
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-th-mfn-official-'));
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
    dest: 'TH',
    partner: '',
    hs6: '850440',
    source: 'official',
    dutyRule: 'mfn',
    ratePct: '5',
    currency: undefined,
    notes: undefined,
    ...overrides,
  };
}

describe('importAseanMfnOfficialFromExcel', () => {
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

  it('parses HS6 + ad-valorem MFN rates and skips specific rates', async () => {
    const path = await writeFixtureXlsx([
      { 'HS CODE': '85044090', 'MFN RATE': '5%' },
      { 'HS CODE': '85183000', 'MFN RATE': 'FREE' },
      { 'HS CODE': '85291000', 'MFN RATE': '10 Baht/kg' },
      { 'HS CODE': 'abc', 'MFN RATE': '3.5%' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importAseanMfnOfficialFromExcel({
      dest: 'TH',
      urlOrPath: path,
      importId: 'imp_th_official_mfn',
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
    const [rows, opts] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];

    expect(rows).toEqual([
      makeRow({ hs6: '850440', ratePct: '5' }),
      makeRow({ hs6: '851830', ratePct: '0' }),
    ]);
    expect(opts).toMatchObject({
      importId: 'imp_th_official_mfn',
      source: 'official',
    });
    expect(opts.makeSourceRef(makeRow({ hs6: '850440' }))).toBe('th:mfn:850440');
  });
});
