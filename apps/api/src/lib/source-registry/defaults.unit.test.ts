import { describe, expect, it } from 'vitest';
import {
  ALL_KNOWN_SOURCE_KEYS,
  ALL_REQUIRED_SOURCE_KEYS,
  NON_REGISTRY_RUNTIME_SOURCE_KEYS,
  OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
  OPTIONAL_LLM_SOURCE_KEYS,
  OPTIONAL_FALLBACK_SOURCE_KEYS,
  SOURCE_REGISTRY_SEEDED_SOURCE_KEYS,
  SOURCE_REGISTRY_DEFAULT_ENTRIES,
  TASK_ONLY_REQUIRED_SOURCE_KEYS,
} from './defaults.js';

describe('source registry defaults', () => {
  it('keeps required source keys unique', () => {
    expect(new Set(ALL_REQUIRED_SOURCE_KEYS).size).toBe(ALL_REQUIRED_SOURCE_KEYS.length);
  });

  it('keeps known source keys unique', () => {
    expect(new Set(ALL_KNOWN_SOURCE_KEYS).size).toBe(ALL_KNOWN_SOURCE_KEYS.length);
  });

  it('builds one default entry per seeded source key', () => {
    expect(SOURCE_REGISTRY_DEFAULT_ENTRIES).toHaveLength(SOURCE_REGISTRY_SEEDED_SOURCE_KEYS.length);
    const keys = new Set(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key));
    expect(keys.size).toBe(SOURCE_REGISTRY_SEEDED_SOURCE_KEYS.length);
  });

  it('includes required and optional seeded source families', () => {
    const keys = new Set(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key));
    for (const key of OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of OFFICIAL_FX_REQUIRED_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of OPTIONAL_FALLBACK_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of TASK_ONLY_REQUIRED_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
    for (const key of OPTIONAL_LLM_SOURCE_KEYS) expect(keys.has(key)).toBe(true);
  });

  it('keeps runtime-only source keys out of seeded source rows', () => {
    const keys = new Set(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key));
    for (const key of NON_REGISTRY_RUNTIME_SOURCE_KEYS) {
      expect(keys.has(key)).toBe(false);
    }
  });

  it('derives expected dataset and schedule defaults for representative keys', () => {
    const byKey = new Map(SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => [entry.key, entry]));

    expect(byKey.get('fx.ecb.daily')?.dataset).toBe('fx');
    expect(byKey.get('de-minimis.official.us.section321')?.dataset).toBe('de_minimis');
    expect(byKey.get('duties.wits.sdmx.base')?.scheduleHint).toBe('manual');
    expect(byKey.get('duties.eu.taric.daily')?.scheduleHint).toBe('daily');
    expect(byKey.get('de-minimis.baseline.seed')?.scheduleHint).toBe('manual');
    expect(byKey.get('freight.cards.json')?.dataset).toBe('freight');
    expect(byKey.get('freight.cards.json')?.scheduleHint).toBe('manual');
    expect(byKey.get('duties.file.json')?.dataset).toBe('duties');
    expect(byKey.get('duties.file.json')?.scheduleHint).toBe('manual');
    expect(byKey.get('surcharges.file.json')?.dataset).toBe('surcharges');
    expect(byKey.get('surcharges.file.json')?.scheduleHint).toBe('manual');
    expect(byKey.get('duties.llm.openai')?.sourceType).toBe('llm');
    expect(byKey.get('duties.llm.openai')?.scheduleHint).toBe('manual');
    expect(byKey.get('duties.llm.openai')?.authStrategy).toBe('api_key');
  });
});
