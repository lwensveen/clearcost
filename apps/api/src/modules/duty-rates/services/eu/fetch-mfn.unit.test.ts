import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseMeasuresMock: vi.fn(),
  parseComponentsMock: vi.fn(),
  parseDutyExpressionsMock: vi.fn(),
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('./base.js', () => ({
  ERGA_OMNES_ID: '1011',
  MFN_MEASURE_TYPE_ID: '103',
  hs6: (value: string) =>
    String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 6),
  parseMeasures: mocks.parseMeasuresMock,
  parseComponents: mocks.parseComponentsMock,
  parseDutyExpressions: mocks.parseDutyExpressionsMock,
  toNumeric3String: (n: number) => Number(n).toFixed(3),
}));

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { fetchEuMfnDutyRates } from './fetch-mfn.js';

describe('fetchEuMfnDutyRates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.parseMeasuresMock.mockResolvedValue(new Map());
    mocks.parseComponentsMock.mockResolvedValue(new Map());
    mocks.parseDutyExpressionsMock.mockResolvedValue(new Set(['01']));
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('throws when TARIC MFN XML URLs are missing', async () => {
    await expect(fetchEuMfnDutyRates({ xmlMeasureUrl: '', xmlComponentUrl: '' })).rejects.toThrow(
      /requires EU_TARIC_MEASURE_URL and EU_TARIC_COMPONENT_URL/i
    );
  });

  it('returns de-duplicated official TARIC rows and keeps highest pct for same key', async () => {
    mocks.parseMeasuresMock.mockResolvedValue(
      new Map([
        [
          'sid-1',
          {
            sid: 'sid-1',
            code10: '0101210000',
            measureTypeId: '103',
            geoId: '1011',
            start: '2025-01-01',
            end: null,
          },
        ],
        [
          'sid-2',
          {
            sid: 'sid-2',
            code10: '0101219900',
            measureTypeId: '103',
            geoId: '1011',
            start: '2025-01-01',
            end: null,
          },
        ],
      ])
    );

    mocks.parseComponentsMock.mockResolvedValue(
      new Map([
        ['sid-1', { pct: 5, compound: false }],
        ['sid-2', { pct: 7.5, compound: true }],
      ])
    );

    const rows = await fetchEuMfnDutyRates({
      xmlMeasureUrl: 'https://example.test/measure.xml',
      xmlComponentUrl: 'https://example.test/component.xml',
      xmlDutyExprUrl: 'https://example.test/duty-expr.xml',
      language: 'en',
    });

    expect(mocks.parseDutyExpressionsMock).toHaveBeenCalledWith(
      'https://example.test/duty-expr.xml',
      'EN'
    );
    expect(mocks.parseMeasuresMock).toHaveBeenCalledTimes(1);
    expect(mocks.parseComponentsMock).toHaveBeenCalledWith(
      'https://example.test/component.xml',
      new Set(['sid-1', 'sid-2']),
      new Set(['01'])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dest: 'EU',
      partner: '',
      hs6: '010121',
      dutyRule: 'mfn',
      ratePct: '7.500',
      notes: 'EU MFN: contains specific/compound components; using ad-valorem only.',
    });
    expect((rows[0]?.effectiveFrom as Date)?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('resolves TARIC URLs from source registry keys when XML overrides are not provided', async () => {
    const urls = new Map<string, string>([
      ['duties.eu.taric.measure', 'https://example.test/measure.xml'],
      ['duties.eu.taric.component', 'https://example.test/component.xml'],
      ['duties.eu.taric.duty_expression', 'https://example.test/duty-expression.xml'],
    ]);

    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => {
        return urls.get(sourceKey) ?? '';
      }
    );

    mocks.parseMeasuresMock.mockResolvedValue(
      new Map([
        [
          'sid-1',
          {
            sid: 'sid-1',
            code10: '0101210000',
            measureTypeId: '103',
            geoId: '1011',
            start: '2025-01-01',
            end: null,
          },
        ],
      ])
    );

    mocks.parseComponentsMock.mockResolvedValue(new Map([['sid-1', { pct: 5, compound: false }]]));

    const rows = await fetchEuMfnDutyRates({ language: 'en' });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.measure' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.component' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'duties.eu.taric.duty_expression' })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ hs6: '010121', ratePct: '5.000' });
  });

  it('returns empty when TARIC parsing yields no MFN measures', async () => {
    mocks.parseMeasuresMock.mockResolvedValue(new Map());

    const rows = await fetchEuMfnDutyRates({
      xmlMeasureUrl: 'https://example.test/measure.xml',
      xmlComponentUrl: 'https://example.test/component.xml',
    });

    expect(rows).toEqual([]);
    expect(mocks.parseComponentsMock).not.toHaveBeenCalled();
  });
});
