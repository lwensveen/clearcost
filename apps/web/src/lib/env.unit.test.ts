/* eslint-disable turbo/no-undeclared-env-vars */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock 'server-only' to avoid import errors in node test env
vi.mock('server-only', () => ({}));

import { requireEnv, requireEnvStrict, optionalEnv } from '../../lib/env';

describe('requireEnv', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns the value when set', () => {
    process.env.TEST_VAR = 'hello';
    expect(requireEnv('TEST_VAR')).toBe('hello');
  });

  it('throws in production (non-build) when missing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    delete process.env.MISSING_VAR;

    expect(() => requireEnv('MISSING_VAR')).toThrow('Missing required env: MISSING_VAR');
  });

  it('warns and returns empty in non-production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.MISSING_VAR;

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = requireEnv('MISSING_VAR');
    expect(result).toBe('');
    expect(spy).toHaveBeenCalledWith('Missing required env: MISSING_VAR');
    spy.mockRestore();
  });

  it('warns and returns empty during production build', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.MISSING_VAR;

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = requireEnv('MISSING_VAR');
    expect(result).toBe('');
    spy.mockRestore();
  });
});

describe('requireEnvStrict', () => {
  it('returns the value when set', () => {
    process.env.STRICT_VAR = 'value';
    expect(requireEnvStrict('STRICT_VAR')).toBe('value');
  });

  it('throws when missing regardless of NODE_ENV', () => {
    delete process.env.MISSING_STRICT;
    expect(() => requireEnvStrict('MISSING_STRICT')).toThrow(
      'Missing required env: MISSING_STRICT'
    );
  });
});

describe('optionalEnv', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns the value when set', () => {
    process.env.OPT_VAR = 'present';
    expect(optionalEnv('OPT_VAR')).toBe('present');
  });

  it('returns undefined when missing', () => {
    delete process.env.OPT_VAR;
    expect(optionalEnv('OPT_VAR')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    process.env.OPT_VAR = '';
    expect(optionalEnv('OPT_VAR')).toBeUndefined();
  });
});
