import { afterEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fetchCnPreferentialDutyRates } from './fetch-preferential.js';

type TempFixture = { dir: string; path: string };
const fixtures: TempFixture[] = [];

async function writeFixtureWorkbook(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'clearcost-cn-fta-'));
  const path = join(dir, 'cn-fta.xlsx');

  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  await writeFile(path, Buffer.from(buffer));
  fixtures.push({ dir, path });
  return path;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture.dir, { recursive: true })));
});

describe('fetchCnPreferentialDutyRates', () => {
  it('parses long-format rows with explicit partner/rate columns', async () => {
    const path = await writeFixtureWorkbook([
      {
        name: 'FTA_Long',
        rows: [
          { 'HS CODE': '85044090', PARTNER: 'Australia', 'PREFERENTIAL RATE': '2.5%' },
          { 'HS CODE': '85183000', PARTNER: 'Korea', 'PREFERENTIAL RATE': 'FREE' },
          { 'HS CODE': '85291000', PARTNER: 'Invalid Label', 'PREFERENTIAL RATE': '7%' },
        ],
      },
    ]);

    const rows = await fetchCnPreferentialDutyRates({ urlOrPath: path });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dest: 'CN',
          partner: 'AU',
          hs6: '850440',
          ratePct: '2.5',
          source: 'official',
          dutyRule: 'fta',
        }),
        expect.objectContaining({
          dest: 'CN',
          partner: 'KR',
          hs6: '851830',
          ratePct: '0',
          source: 'official',
          dutyRule: 'fta',
        }),
      ])
    );
    expect(rows).toHaveLength(2);
  });

  it('parses wide partner columns and applies partner/hs6 filters', async () => {
    const path = await writeFixtureWorkbook([
      {
        name: 'FTA_Wide',
        rows: [
          { HS: '85044090', Australia: '2%', Korea: '3%', Notes: 'RCEP' },
          { HS: '85183000', Australia: '1.2%', Korea: 'FREE', Notes: 'RCEP' },
        ],
      },
    ]);

    const rows = await fetchCnPreferentialDutyRates({
      urlOrPath: path,
      partnerGeoIds: ['KR'],
      hs6List: ['851830'],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dest: 'CN',
      partner: 'KR',
      hs6: '851830',
      ratePct: '0',
      notes: 'RCEP',
      source: 'official',
      dutyRule: 'fta',
    });
  });
});
