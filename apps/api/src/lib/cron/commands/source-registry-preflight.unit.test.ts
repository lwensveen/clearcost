import { describe, expect, it } from 'vitest';
import { evaluateSourceRegistryPreflight } from './source-registry-preflight.js';

describe('source registry preflight', () => {
  it('passes when required official keys are enabled and fallback keys exist', () => {
    const result = evaluateSourceRegistryPreflight({
      rows: [
        { key: 'duties.eu.taric.daily', enabled: true },
        { key: 'fx.ecb.daily', enabled: true },
        { key: 'vat.oecd_imf.standard', enabled: true },
        { key: 'de-minimis.official.eu.reg_1186_2009', enabled: true },
        { key: 'hs.eu.taric.goods', enabled: true },
        { key: 'notices.cn.mof.list', enabled: true },
        { key: 'surcharges.us.statute.hmf', enabled: true },
        { key: 'duties.wits.sdmx.base', enabled: false },
      ],
      requiredDutySourceKeys: ['duties.eu.taric.daily'],
      requiredFxSourceKeys: ['fx.ecb.daily'],
      requiredVatSourceKeys: ['vat.oecd_imf.standard'],
      requiredDeMinimisSourceKeys: ['de-minimis.official.eu.reg_1186_2009'],
      requiredHsSourceKeys: ['hs.eu.taric.goods'],
      requiredNoticesSourceKeys: ['notices.cn.mof.list'],
      requiredSurchargesSourceKeys: ['surcharges.us.statute.hmf'],
      fallbackSourceKeys: ['duties.wits.sdmx.base'],
    });

    expect(result.gateOk).toBe(true);
    expect(result.failedChecks).toEqual([]);
  });

  it('fails when a required official key is disabled', () => {
    const result = evaluateSourceRegistryPreflight({
      rows: [{ key: 'fx.ecb.daily', enabled: false }],
      requiredDutySourceKeys: [],
      requiredFxSourceKeys: ['fx.ecb.daily'],
      requiredVatSourceKeys: [],
      requiredDeMinimisSourceKeys: [],
      requiredHsSourceKeys: [],
      requiredNoticesSourceKeys: [],
      requiredSurchargesSourceKeys: [],
      fallbackSourceKeys: [],
    });

    expect(result.gateOk).toBe(false);
    expect(result.failedChecks).toEqual([
      {
        key: 'source_registry.fx.fx.ecb.daily',
        ok: false,
        detail: 'source_registry row for fx.ecb.daily is disabled',
      },
    ]);
  });

  it('fails when fallback source keys are missing', () => {
    const result = evaluateSourceRegistryPreflight({
      rows: [{ key: 'de-minimis.trade_gov.api', enabled: true }],
      requiredDutySourceKeys: [],
      requiredFxSourceKeys: [],
      requiredVatSourceKeys: [],
      requiredDeMinimisSourceKeys: [],
      requiredHsSourceKeys: [],
      requiredNoticesSourceKeys: [],
      requiredSurchargesSourceKeys: [],
      fallbackSourceKeys: ['de-minimis.trade_gov.api', 'de-minimis.zonos.docs'],
    });

    expect(result.gateOk).toBe(false);
    expect(result.failedChecks).toEqual([
      {
        key: 'source_registry.fallback.de-minimis.zonos.docs',
        ok: false,
        detail: 'Missing source_registry row for de-minimis.zonos.docs',
      },
    ]);
  });
});
