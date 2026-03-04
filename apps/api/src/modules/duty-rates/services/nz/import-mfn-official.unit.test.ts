import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DutyRateInsert } from '@clearcost/types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as XLSX from 'xlsx';

const mocks = vi.hoisted(() => ({
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
}));

vi.mock('../../utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

import { importNzMfnOfficial } from './import-mfn-official.js';

type TempFixture = { dir: string; path: string };

const fixtures: TempFixture[] = [];

function createTar(entries: Array<{ path: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];

  for (const entry of entries) {
    const header = Buffer.alloc(512, 0);
    header.write(entry.path.slice(0, 100), 0, 'utf8');
    header.write('0000777', 100, 'ascii');
    header.write('0000000', 108, 'ascii');
    header.write('0000000', 116, 'ascii');
    header.write(entry.data.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
    header.write(
      Math.floor(Date.now() / 1000)
        .toString(8)
        .padStart(11, '0') + '\0',
      136,
      'ascii'
    );
    header.write('0', 156, 'ascii');
    header.write('ustar', 257, 'ascii');
    parts.push(header);
    parts.push(entry.data);

    const remainder = entry.data.length % 512;
    if (remainder !== 0) {
      parts.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}

async function writeTarGzFixture(rows: Array<Record<string, unknown>>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-nz-mfn-official-'));
  const path = join(dir, 'tarifftar.tar.gz');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tariff');
  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const tarBuffer = createTar([
    {
      path: '01-99-2026.xlsx',
      data: Buffer.from(workbookBuffer),
    },
  ]);

  await writeFile(path, gzipSync(tarBuffer));
  fixtures.push({ dir, path });
  return path;
}

function makeRow(overrides: Partial<DutyRateInsert>): DutyRateInsert {
  return {
    dest: 'NZ',
    partner: '',
    hs6: '850440',
    source: 'official',
    dutyRule: 'mfn',
    ratePct: '5',
    currency: undefined,
    notes: 'NZ Customs tariff MFN (official)',
    ...overrides,
  };
}

describe('importNzMfnOfficial', () => {
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

  it('parses tariff data from a .tar.gz archive and skips non-ad-valorem rows', async () => {
    const path = await writeTarGzFixture([
      { 'Tariff Item': '85044010', 'Rate of Duty': '5%' },
      { 'Tariff Item': '85183000', 'Rate of Duty': 'Free' },
      { 'Tariff Item': '85291000', 'Rate of Duty': '2 NZD/kg' },
      { 'Tariff Item': 'abc', 'Rate of Duty': '4%' },
    ]);

    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });

    const out = await importNzMfnOfficial({
      urlOrPath: path,
      importId: 'imp_nz_mfn',
    });

    expect(out).toMatchObject({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      scanned: 4,
      kept: 2,
      skipped: 2,
      sourceFile: '01-99-2026.xlsx',
    });

    const [rows, opts] = mocks.batchUpsertDutyRatesFromStreamMock.mock.calls[0] ?? [];
    expect(rows).toEqual([
      makeRow({ hs6: '850440', ratePct: '5' }),
      makeRow({ hs6: '851830', ratePct: '0' }),
    ]);
    expect(opts).toMatchObject({
      importId: 'imp_nz_mfn',
      source: 'official',
    });
    expect(opts.makeSourceRef(makeRow({ hs6: '850440' }))).toBe('nz:mfn:850440');
  });
});
