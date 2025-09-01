import { describe, expect, it } from 'vitest';
import { parseDateMaybe } from '../parse-date-maybe.js';

describe('parseDateMaybe', () => {
  it('returns undefined for non-string inputs', () => {
    const cases = [null, undefined, 0, 123, true, false, {}, [], new Date()];
    for (const c of cases) {
      expect(parseDateMaybe(c)).toBeUndefined();
    }
  });

  it('returns undefined for empty string', () => {
    expect(parseDateMaybe('')).toBeUndefined();
  });

  it('parses YYYY-MM-DD as midnight UTC', () => {
    const d = parseDateMaybe('2025-09-01');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-09-01T00:00:00.000Z');
  });

  it('passes through full ISO strings (with Z) unchanged', () => {
    const d = parseDateMaybe('2025-09-01T12:34:56Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-09-01T12:34:56.000Z');
  });

  it('returns undefined for clearly invalid date strings', () => {
    expect(parseDateMaybe('not-a-date')).toBeUndefined();
    expect(parseDateMaybe('2025-13-01')).toBeUndefined(); // invalid month
  });

  it('parses epoch correctly', () => {
    const d = parseDateMaybe('1970-01-01');
    expect(d).toBeInstanceOf(Date);
    expect(+d!).toBe(0); // epoch at 00:00:00Z
  });
});
