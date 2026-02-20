import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importSurchargesMock: vi.fn(),
  parseGeoAreaDescriptionsMock: vi.fn(),
  parseDutyExpressionsMock: vi.fn(),
  parseMeasuresMock: vi.fn(),
  parseComponentsMock: vi.fn(),
  resolveSourceDownloadUrlMock: vi.fn(),
}));

vi.mock('../import-surcharges.js', () => ({
  importSurcharges: mocks.importSurchargesMock,
}));

vi.mock('../../../duty-rates/services/eu/base.js', async () => {
  const actual = await vi.importActual<typeof import('../../../duty-rates/services/eu/base.js')>(
    '../../../duty-rates/services/eu/base.js'
  );
  return {
    ...actual,
    parseGeoAreaDescriptions: mocks.parseGeoAreaDescriptionsMock,
    parseDutyExpressions: mocks.parseDutyExpressionsMock,
    parseMeasures: mocks.parseMeasuresMock,
    parseComponents: mocks.parseComponentsMock,
  };
});

vi.mock('../../../../lib/source-registry.js', () => ({
  resolveSourceDownloadUrl: mocks.resolveSourceDownloadUrlMock,
}));

import { importEuTradeRemediesAsSurcharges } from './import-remedies.js';

describe('importEuTradeRemediesAsSurcharges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.importSurchargesMock.mockResolvedValue({ ok: true, count: 1 });
    mocks.parseGeoAreaDescriptionsMock.mockResolvedValue(new Map([['CN', 'China']]));
    mocks.parseDutyExpressionsMock.mockResolvedValue(new Set(['01']));
    mocks.parseMeasuresMock.mockImplementation(
      async (
        _url: string,
        keep: (m: {
          sid: string;
          code10: string;
          measureTypeId: string;
          geoId: string;
          start?: string;
          end?: string | null;
        }) => boolean
      ) => {
        const measure = {
          sid: 'm1',
          code10: '1234567890',
          measureTypeId: '551',
          geoId: 'CN',
          start: '2025-01-01',
          end: null,
        };
        return keep(measure) ? new Map([[measure.sid, measure]]) : new Map();
      }
    );
    mocks.parseComponentsMock.mockResolvedValue(new Map([['m1', { pct: 25, compound: false }]]));
    mocks.resolveSourceDownloadUrlMock.mockResolvedValue('');
  });

  it('writes pctAmt as ad-valorem fraction (0..1) for EU remedy rows', async () => {
    const out = await importEuTradeRemediesAsSurcharges({
      measureTypeIds: ['551'],
      xmlMeasureUrl: 'https://example.com/measure.xml',
      xmlComponentUrl: 'https://example.com/component.xml',
      xmlGeoDescUrl: 'https://example.com/geo.xml',
      xmlDutyExprUrl: 'https://example.com/duty.xml',
    });

    expect(out).toEqual({ ok: true, count: 1 });
    expect(mocks.importSurchargesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        dest: 'EU',
        origin: 'CN',
        hs6: '123456',
        surchargeCode: 'TRADE_REMEDY_232',
        pctAmt: '0.250000',
      }),
    ]);
  });

  it('fails fast when remedy measure types are not configured', async () => {
    await expect(
      importEuTradeRemediesAsSurcharges({
        measureTypeIds: [],
        xmlMeasureUrl: 'https://example.com/measure.xml',
        xmlComponentUrl: 'https://example.com/component.xml',
      })
    ).rejects.toThrow(/requires at least one measure type id/i);
  });

  it('fails fast when TARIC filter yields zero remedy measures', async () => {
    mocks.parseMeasuresMock.mockResolvedValueOnce(new Map());

    await expect(
      importEuTradeRemediesAsSurcharges({
        measureTypeIds: ['551'],
        xmlMeasureUrl: 'https://example.com/measure.xml',
        xmlComponentUrl: 'https://example.com/component.xml',
        xmlGeoDescUrl: 'https://example.com/geo.xml',
        xmlDutyExprUrl: 'https://example.com/duty.xml',
      })
    ).rejects.toThrow(/produced 0 measures/i);
  });

  it('resolves TARIC URLs from source registry keys when XML overrides are not provided', async () => {
    const urls = new Map<string, string>([
      ['surcharges.eu.taric.measure', 'https://example.com/measure.xml'],
      ['surcharges.eu.taric.component', 'https://example.com/component.xml'],
      ['surcharges.eu.taric.geo_description', 'https://example.com/geo.xml'],
      ['surcharges.eu.taric.duty_expression', 'https://example.com/duty.xml'],
    ]);
    mocks.resolveSourceDownloadUrlMock.mockImplementation(
      async ({ sourceKey }: { sourceKey: string }) => urls.get(sourceKey) ?? ''
    );

    await importEuTradeRemediesAsSurcharges({
      measureTypeIds: ['551'],
    });

    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'surcharges.eu.taric.measure' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'surcharges.eu.taric.component' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'surcharges.eu.taric.geo_description' })
    );
    expect(mocks.resolveSourceDownloadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: 'surcharges.eu.taric.duty_expression' })
    );
    expect(mocks.parseMeasuresMock).toHaveBeenCalledWith(
      'https://example.com/measure.xml',
      expect.any(Function)
    );
    expect(mocks.parseComponentsMock).toHaveBeenCalledWith(
      'https://example.com/component.xml',
      expect.any(Set),
      expect.any(Set)
    );
  });
});
