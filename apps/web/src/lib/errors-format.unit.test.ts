import { describe, it, expect } from 'vitest';
import { formatError, ApiError, UpstreamError } from '../../lib/errors';

describe('formatError', () => {
  it('extracts message from ApiError', () => {
    const err = new ApiError(400, 'bad request');
    expect(formatError(err)).toBe('bad request');
  });

  it('extracts message from UpstreamError', () => {
    const err = new UpstreamError(502, 'gateway timeout');
    expect(formatError(err)).toBe('gateway timeout');
  });

  it('formats { status, message } objects', () => {
    expect(formatError({ status: 404, message: 'not found' })).toBe('404 not found');
  });

  it('extracts message from plain Error', () => {
    expect(formatError(new Error('oops'))).toBe('oops');
  });

  it('returns fallback for null/undefined', () => {
    expect(formatError(null)).toBe('Unknown error');
    expect(formatError(undefined)).toBe('Unknown error');
    expect(formatError(null, 'custom')).toBe('custom');
  });

  it('stringifies other values', () => {
    expect(formatError(42)).toBe('42');
    expect(formatError('plain string')).toBe('plain string');
  });
});

describe('ApiError', () => {
  it('has status and body', () => {
    const err = new ApiError(422, 'validation failed', { field: 'name' });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(422);
    expect(err.message).toBe('validation failed');
    expect(err.body).toEqual({ field: 'name' });
  });
});

describe('UpstreamError', () => {
  it('has status and body', () => {
    const err = new UpstreamError(500, 'internal', { detail: 'crash' });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(500);
    expect(err.message).toBe('internal');
    expect(err.body).toEqual({ detail: 'crash' });
  });
});
