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

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => validateApiRuntimeEnv()).toThrow(/Missing required API env vars: DATABASE_URL/);
  });

  it('throws with both production-only secrets when missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    delete process.env.API_KEY_PEPPER;
    delete process.env.INTERNAL_SIGNING_SECRET;

    expect(() => validateApiRuntimeEnv()).toThrow(
      /Missing required API env vars: API_KEY_PEPPER, INTERNAL_SIGNING_SECRET/
    );
  });

  it('throws on invalid public port', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    process.env.PORT = '70000';
    expect(() => validateApiRuntimeEnv()).toThrow(/Invalid PORT/);
  });

  it('throws on invalid internal port', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    process.env.INTERNAL_PORT = 'abc';
    expect(() => validateApiRuntimeEnv()).toThrow(/Invalid INTERNAL_PORT/);
  });

  it('uses defaults and parses optional runtime flags', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    process.env.ALLOW_INTERNAL_BIND = '1';
    process.env.TRUST_PROXY = 'loopback';

    const env = validateApiRuntimeEnv();
    expect(env.publicHost).toBe('0.0.0.0');
    expect(env.publicPort).toBe(3001);
    expect(env.internalHost).toBe('0.0.0.0');
    expect(env.internalPort).toBe(3002);
    expect(env.allowInternalBind).toBe(true);
    expect(env.trustProxy).toBe('loopback');
  });

  it('accepts explicit valid ports', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/clearcost';
    process.env.PORT = '4100';
    process.env.INTERNAL_PORT = '4200';

    const env = validateApiRuntimeEnv();
    expect(env.publicPort).toBe(4100);
    expect(env.internalPort).toBe(4200);
  });
});
