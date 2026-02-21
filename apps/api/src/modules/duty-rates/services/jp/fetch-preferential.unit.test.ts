import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestJpTariffBaseMock: vi.fn(),
  listJpTariffChapterPagesMock: vi.fn(),
  httpFetchMock: vi.fn(),
}));

vi.mock('./etax-source.js', () => ({
  getLatestJpTariffBase: mocks.getLatestJpTariffBaseMock,
  listJpTariffChapterPages: mocks.listJpTariffChapterPagesMock,
}));

vi.mock('../../../../lib/http.js', () => ({
  httpFetch: mocks.httpFetchMock,
}));

import { fetchJpPreferentialDutyRates } from './fetch-preferential.js';

function htmlResponse(html: string) {
  return {
    ok: true,
    text: async () => html,
  };
}

describe('fetchJpPreferentialDutyRates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getLatestJpTariffBaseMock.mockResolvedValue(
      'https://www.customs.go.jp/english/tariff/2025_4_1/'
    );
    mocks.listJpTariffChapterPagesMock.mockResolvedValue([
      'https://www.customs.go.jp/english/tariff/2025_4_1/data/e_01.htm',
    ]);
  });

  it('parses partner-specific official rates from chapter tables', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      htmlResponse(`
        <table>
          <tr>
            <th>HS Code</th>
            <th>WTO</th>
            <th>Australia</th>
            <th>United States</th>
            <th>EU</th>
          </tr>
          <tr>
            <td>0101.21-000</td>
            <td>5%</td>
            <td>2%</td>
            <td>FREE</td>
            <td>3.5%</td>
          </tr>
          <tr>
            <td>0201.10</td>
            <td>10%</td>
            <td>8%</td>
            <td></td>
            <td>7%</td>
          </tr>
        </table>
      `)
    );

    const rows = await fetchJpPreferentialDutyRates({
      editionBase: 'https://www.customs.go.jp/english/tariff/2025_4_1/',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dest: 'JP', partner: 'AU', hs6: '010121', ratePct: '2' }),
        expect.objectContaining({ dest: 'JP', partner: 'US', hs6: '010121', ratePct: '0' }),
        expect.objectContaining({ dest: 'JP', partner: 'EU', hs6: '010121', ratePct: '3.5' }),
        expect.objectContaining({ dest: 'JP', partner: 'AU', hs6: '020110', ratePct: '8' }),
        expect.objectContaining({ dest: 'JP', partner: 'EU', hs6: '020110', ratePct: '7' }),
      ])
    );
    expect(rows.every((row) => row.source === 'official')).toBe(true);
    expect(rows.every((row) => row.dutyRule === 'fta')).toBe(true);
  });

  it('filters by partner and hs6 when requested', async () => {
    mocks.httpFetchMock.mockResolvedValue(
      htmlResponse(`
        <table>
          <tr><th>HS Code</th><th>Australia</th><th>United States</th></tr>
          <tr><td>0101.21-000</td><td>2%</td><td>1%</td></tr>
          <tr><td>0201.10</td><td>8%</td><td>4%</td></tr>
        </table>
      `)
    );

    const rows = await fetchJpPreferentialDutyRates({
      editionBase: 'https://www.customs.go.jp/english/tariff/2025_4_1/',
      partnerGeoIds: ['US'],
      hs6List: ['020110'],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dest: 'JP',
      partner: 'US',
      hs6: '020110',
      ratePct: '4',
      source: 'official',
    });
  });
});
