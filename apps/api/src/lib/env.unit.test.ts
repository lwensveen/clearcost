import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveMetricsRequireSigning, validateApiRuntimeEnv } from './env.js';

const envSnapshot = { ...process.env };

beforeEach(() => {
  process.env = { ...envSnapshot };
});

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe('resolveMetricsRequireSigning', () => {
  it('defaults to required in production when unset', () => {
    expect(
      resolveMetricsRequireSigning({ NODE_ENV: 'production', METRICS_REQUIRE_SIGNING: undefined })
    ).toBe(true);
  });

  it('allows opt-out in production with METRICS_REQUIRE_SIGNING=0', () => {
    expect(
      resolveMetricsRequireSigning({ NODE_ENV: 'production', METRICS_REQUIRE_SIGNING: '0' })
    ).toBe(false);
  });

  it('defaults to optional in non-production unless explicitly enabled', () => {
    expect(
      resolveMetricsRequireSigning({ NODE_ENV: 'development', METRICS_REQUIRE_SIGNING: undefined })
    ).toBe(false);
    expect(resolveMetricsRequireSigning({ NODE_ENV: 'test', METRICS_REQUIRE_SIGNING: '1' })).toBe(
      true
    );
  });
});

describe('validateApiRuntimeEnv', () => {
  it('applies resolved metrics signing in production runtime env', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    process.env.API_KEY_PEPPER = 'pepper';
    process.env.INTERNAL_SIGNING_SECRET = 'internal-secret';
    process.env.METRICS_REQUIRE_SIGNING = '0';

    const env = validateApiRuntimeEnv();
    expect(env.metricsRequireSigning).toBe(false);
  });
});
