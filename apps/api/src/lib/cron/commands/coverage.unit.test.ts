import { describe, expect, it } from 'vitest';
import { evaluateKnownSourceKeys, evaluateRequiredSourceKeys } from './coverage.js';

describe('coverage source-registry gates', () => {
  it('passes when all required source keys exist and are enabled', () => {
    const checks = evaluateRequiredSourceKeys(
      ['duties.eu.taric.daily', 'duties.us.usitc.base'],
      [
        { key: 'duties.eu.taric.daily', enabled: true },
        { key: 'duties.us.usitc.base', enabled: true },
      ]
    );

    expect(checks).toEqual([
      {
        key: 'source_registry.duties.duties.eu.taric.daily',
        ok: true,
        detail: 'source_registry row for duties.eu.taric.daily is enabled',
      },
      {
        key: 'source_registry.duties.duties.us.usitc.base',
        ok: true,
        detail: 'source_registry row for duties.us.usitc.base is enabled',
      },
    ]);
  });

  it('fails when required source keys are missing or disabled', () => {
    const checks = evaluateRequiredSourceKeys(
      ['duties.eu.taric.daily', 'duties.us.usitc.base', 'duties.jp.customs.tariff_index'],
      [
        { key: 'duties.eu.taric.daily', enabled: true },
        { key: 'duties.us.usitc.base', enabled: false },
      ]
    );

    expect(checks).toEqual([
      {
        key: 'source_registry.duties.duties.eu.taric.daily',
        ok: true,
        detail: 'source_registry row for duties.eu.taric.daily is enabled',
      },
      {
        key: 'source_registry.duties.duties.us.usitc.base',
        ok: false,
        detail: 'source_registry row for duties.us.usitc.base is disabled',
      },
      {
        key: 'source_registry.duties.duties.jp.customs.tariff_index',
        ok: false,
        detail: 'Missing source_registry row for duties.jp.customs.tariff_index',
      },
    ]);
  });

  it('uses dataset namespace in generated check keys', () => {
    const checks = evaluateRequiredSourceKeys(
      ['fx.ecb.daily'],
      [{ key: 'fx.ecb.daily', enabled: true }],
      'fx'
    );

    expect(checks).toEqual([
      {
        key: 'source_registry.fx.fx.ecb.daily',
        ok: true,
        detail: 'source_registry row for fx.ecb.daily is enabled',
      },
    ]);
  });

  it('tracks fallback source keys as present even when disabled', () => {
    const checks = evaluateKnownSourceKeys(
      ['duties.wits.sdmx.base', 'hs.wits.sdmx.data_base'],
      [
        { key: 'duties.wits.sdmx.base', enabled: false },
        { key: 'hs.wits.sdmx.data_base', enabled: true },
      ],
      'fallback'
    );

    expect(checks).toEqual([
      {
        key: 'source_registry.fallback.duties.wits.sdmx.base',
        ok: true,
        detail: 'source_registry row for duties.wits.sdmx.base is disabled',
      },
      {
        key: 'source_registry.fallback.hs.wits.sdmx.data_base',
        ok: true,
        detail: 'source_registry row for hs.wits.sdmx.data_base is enabled',
      },
    ]);
  });

  it('fails fallback source checks when source_registry rows are missing', () => {
    const checks = evaluateKnownSourceKeys(
      ['de-minimis.trade_gov.api', 'de-minimis.zonos.docs'],
      [{ key: 'de-minimis.trade_gov.api', enabled: true }],
      'fallback'
    );

    expect(checks).toEqual([
      {
        key: 'source_registry.fallback.de-minimis.trade_gov.api',
        ok: true,
        detail: 'source_registry row for de-minimis.trade_gov.api is enabled',
      },
      {
        key: 'source_registry.fallback.de-minimis.zonos.docs',
        ok: false,
        detail: 'Missing source_registry row for de-minimis.zonos.docs',
      },
    ]);
  });
});
