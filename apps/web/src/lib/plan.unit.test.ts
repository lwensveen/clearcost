import { describe, it, expect } from 'vitest';
import { getDailyComputeLimit, todayKey } from '../../lib/plan';

describe('getDailyComputeLimit', () => {
  it('returns 10 for free plan', () => {
    expect(getDailyComputeLimit('free')).toBe(10);
  });

  it('returns 200 for starter plan', () => {
    expect(getDailyComputeLimit('starter')).toBe(200);
  });

  it('returns 2000 for growth plan', () => {
    expect(getDailyComputeLimit('growth')).toBe(2000);
  });

  it('returns 10000 for scale plan', () => {
    expect(getDailyComputeLimit('scale')).toBe(10000);
  });

  it('is case-insensitive', () => {
    expect(getDailyComputeLimit('FREE')).toBe(10);
    expect(getDailyComputeLimit('Starter')).toBe(200);
    expect(getDailyComputeLimit('GROWTH')).toBe(2000);
  });

  it('defaults to free when undefined', () => {
    expect(getDailyComputeLimit()).toBe(10);
    expect(getDailyComputeLimit(undefined)).toBe(10);
  });

  it('defaults to free for unknown plan', () => {
    expect(getDailyComputeLimit('enterprise')).toBe(10);
  });
});

describe('todayKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = todayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches today date', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(todayKey()).toBe(expected);
  });
});
