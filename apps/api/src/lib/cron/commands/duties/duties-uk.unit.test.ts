import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withRunMock: vi.fn(),
  resolveUkTariffDutySourceUrlsMock: vi.fn(),
  batchUpsertDutyRatesFromStreamMock: vi.fn(),
  streamUkMfnDutyRatesMock: vi.fn(),
  streamUkPreferentialDutyRatesMock: vi.fn(),
}));

vi.mock('../../runtime.js', () => ({
  withRun: mocks.withRunMock,
}));

vi.mock('../../../../modules/duty-rates/services/uk/source-urls.js', () => ({
  resolveUkTariffDutySourceUrls: mocks.resolveUkTariffDutySourceUrlsMock,
}));

vi.mock('../../../../modules/duty-rates/utils/batch-upsert.js', () => ({
  batchUpsertDutyRatesFromStream: mocks.batchUpsertDutyRatesFromStreamMock,
}));

vi.mock('../../../../modules/duty-rates/services/uk/mfn.js', () => ({
  streamUkMfnDutyRates: mocks.streamUkMfnDutyRatesMock,
}));

vi.mock('../../../../modules/duty-rates/services/uk/preferential.js', () => ({
  streamUkPreferentialDutyRates: mocks.streamUkPreferentialDutyRatesMock,
}));

import { dutiesUkAllOfficial, dutiesUkMfnOfficial } from './duties-uk.js';

function emptyStream() {
  return (async function* () {})();
}

describe('duties-uk commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    mocks.withRunMock.mockImplementation(async (_ctx, work) => {
      const out = await work('run-123');
      return out.payload;
    });
    mocks.resolveUkTariffDutySourceUrlsMock.mockResolvedValue({
      apiBaseUrl: 'https://uk.example/api',
    });
    mocks.streamUkMfnDutyRatesMock.mockReturnValue(emptyStream());
    mocks.streamUkPreferentialDutyRatesMock.mockReturnValue(emptyStream());
    mocks.batchUpsertDutyRatesFromStreamMock.mockResolvedValue({
      ok: true,
      inserted: 2,
      updated: 0,
      count: 2,
      dryRun: false,
    });
  });

  it('runs UK MFN official import with source metadata', async () => {
    await dutiesUkMfnOfficial([
      '--hs6=850440',
      '--apiBaseUrl=https://override.example',
      '--batchSize=1000',
      '--dryRun=1',
    ]);

    expect(mocks.resolveUkTariffDutySourceUrlsMock).toHaveBeenCalledWith({
      apiBaseUrl: 'https://override.example',
    });
    expect(mocks.streamUkMfnDutyRatesMock).toHaveBeenCalledWith({
      hs6List: ['850440'],
      apiBaseUrl: 'https://uk.example/api',
    });
    expect(mocks.batchUpsertDutyRatesFromStreamMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        batchSize: 1000,
        dryRun: true,
        importId: 'run-123',
      })
    );
    const [ctx] = mocks.withRunMock.mock.calls[0] ?? [];
    expect(ctx).toMatchObject({
      importSource: 'UK_TT',
      job: 'duties:uk-mfn-official',
      sourceKey: 'duties.uk.tariff.api_base',
      sourceUrl: 'https://uk.example/api',
    });
  });

  it('runs both UK official steps for import:duties:uk-all-official', async () => {
    await dutiesUkAllOfficial(['--partners=US,JP', '--hs6=850440']);

    expect(mocks.withRunMock).toHaveBeenCalledTimes(2);
    const [mfnCall, ftaCall] = mocks.withRunMock.mock.calls;
    expect(mfnCall?.[0]).toMatchObject({ job: 'duties:uk-mfn-official' });
    expect(ftaCall?.[0]).toMatchObject({ job: 'duties:uk-fta-official' });
    expect(mocks.streamUkPreferentialDutyRatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hs6List: ['850440'],
        partners: ['US', 'JP'],
        apiBaseUrl: 'https://uk.example/api',
      })
    );
  });
});
