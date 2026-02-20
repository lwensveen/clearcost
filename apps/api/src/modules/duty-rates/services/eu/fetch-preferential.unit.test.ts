import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseMeasuresMock: vi.fn(),
  parseComponentsMock: vi.fn(),
  parseDutyExpressionsMock: vi.fn(),
  parseGeoAreaDescriptionsMock: vi.fn(),
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('./base.js', () => ({
  ERGA_OMNES_ID: '1011',
  PREF_MEASURE_TYPE_IDS: new Set(['300']),
  hs6: (value: string) =>
    String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 6),
  parseMeasures: mocks.parseMeasuresMock,
  parseComponents: mocks.parseComponentsMock,
  parseDutyExpressions: mocks.parseDutyExpressionsMock,
  parseGeoAreaDescriptions: mocks.parseGeoAreaDescriptionsMock,
  toNumeric3String: (n: number) => Number(n).toFixed(3),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { fetchEuPreferentialDutyRates } from './fetch-preferential.js';

describe('fetchEuPreferentialDutyRates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.parseMeasuresMock.mockResolvedValue(new Map());
    mocks.parseComponentsMock.mockResolvedValue(new Map());
    mocks.parseDutyExpressionsMock.mockResolvedValue(new Set(['01']));
    mocks.parseGeoAreaDescriptionsMock.mockResolvedValue(new Map());
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('returns empty when required TARIC XML URLs are missing', async () => {
    const rows = await fetchEuPreferentialDutyRates({
      xmlMeasureUrl: '',
      xmlComponentUrl: '',
    });

    expect(rows).toEqual([]);
    expect(mocks.parseMeasuresMock).not.toHaveBeenCalled();
  });

  it('resolves TARIC URLs from source registry keys when XML overrides are not provided', async () => {
    const urls = new Map<string, string>([
      ['duties.eu.taric.measure', 'https://example.test/measure.xml'],
      ['duties.eu.taric.component', 'https://example.test/component.xml'],
      ['duties.eu.taric.geo_description', 'https://example.test/geo-desc.xml'],
      ['duties.eu.taric.duty_expression', 'https://example.test/duty-expression.xml'],
    ]);

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => {
        return urls.get(sourceKey) ?? '';
      }
    );

    mocks.parseGeoAreaDescriptionsMock.mockResolvedValue(new Map([['JP', 'Japan']]));
    mocks.parseMeasuresMock.mockResolvedValue(
      new Map([
        [
          'sid-1',
          {
            sid: 'sid-1',
            code10: '0101210000',
            measureTypeId: '300',
            geoId: 'JP',
            start: '2025-01-01',
            end: null,
          },
        ],
      ])
    );
    mocks.parseComponentsMock.mockResolvedValue(
      new Map([['sid-1', { pct: 2.5, compound: false }]])
    );

    const rows = await fetchEuPreferentialDutyRates({ language: 'en' });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.measure' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.component' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.geo_description' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.duty_expression' })
    );
    expect(mocks.parseMeasuresMock).toHaveBeenCalledWith(
      'https://example.test/measure.xml',
      expect.any(Function)
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dest: 'EU',
      partner: 'JP',
      hs6: '010121',
      dutyRule: 'fta',
      ratePct: '2.500',
    });
  });
});
