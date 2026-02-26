import { describe, expect, it } from 'vitest';
import {
  ALL_REQUIRED_SOURCE_KEYS,
  OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
  OPTIONAL_FALLBACK_SOURCE_KEYS,
  SOURCE_REGISTRY_DEFAULT_ENTRIES,
} from './defaults.js';

describe('source registry defaults', () => {
  it('keeps required source keys unique', () => {
    expect(new Set(ALL_REQUIRED_SOURCE_KEYS).size).toBe(ALL_REQUIRED_SOURCE_KEYS.length);
  });

  it('builds one default entry per required key', () => {
    expect(SOURCE_REGISTRY_DEFAULT_ENTRIES).toHaveLength(ALL_REQUIRED_SOURCE_KEYS.length);
    const keys = new Set(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key));
    expect(keys.size).toBe(ALL_REQUIRED_SOURCE_KEYS.length);
  });

  it('includes duty, fx, and fallback key families', () => {
    const keys = new Set(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key));
    for (const key of OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of OFFICIAL_FX_REQUIRED_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of OPTIONAL_FALLBACK_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
  });

  it('derives expected dataset and schedule defaults for representative keys', () => {
    const byKey = new Map(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => [entry.key, entry]));

    expect(byKey.get('fx.ecb.daily')?.dataset).toBe('fx');
    expect(byKey.get('de-minimis.official.us.section321')?.dataset).toBe('de_minimis');
    expect(byKey.get('duties.wits.sdmx.base')?.scheduleHint).toBe('manual');
    expect(byKey.get('duties.eu.taric.daily')?.scheduleHint).toBe('daily');
  });
});
