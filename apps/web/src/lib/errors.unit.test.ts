import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from '../../lib/errors';

describe('extractErrorMessage', () => {
  it('handles { error: "string" }', () => {
    expect(extractErrorMessage({ error: 'bad' }, 'fallback')).toBe('bad');
  });

  it('handles { error: { code, message } }', () => {
    expect(extractErrorMessage({ error: { code: 'X', message: 'msg' } }, 'fallback')).toBe('msg');
  });

  it('falls back when message is empty', () => {
    expect(extractErrorMessage({ error: { code: 'X', message: '' } }, 'fallback')).toBe('fallback');
  });

  it('handles plain string input', () => {
    expect(extractErrorMessage('oops', 'fallback')).toBe('oops');
  });

  it('handles null/undefined/empty object', () => {
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(extractErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
