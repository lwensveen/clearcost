import { describe, it, expect } from 'vitest';
import {
  canonicalInternalBody,
  internalBodyHash,
  buildInternalSignaturePayload,
  computeInternalSignature,
  timingSafeHexEqual,
} from '../internal-signing.js';

describe('internal-signing', () => {
  describe('canonicalInternalBody', () => {
    it('returns string body as-is', () => {
      expect(canonicalInternalBody('hello')).toBe('hello');
    });

    it('returns "{}" for null', () => {
      expect(canonicalInternalBody(null)).toBe('{}');
    });

    it('returns "{}" for undefined', () => {
      expect(canonicalInternalBody(undefined)).toBe('{}');
    });

    it('stringifies objects', () => {
      expect(canonicalInternalBody({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('internalBodyHash', () => {
    it('produces a 64-char hex SHA-256 hash', () => {
      const hash = internalBodyHash('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      expect(internalBodyHash('foo')).toBe(internalBodyHash('foo'));
    });

    it('differs for different inputs', () => {
      expect(internalBodyHash('a')).not.toBe(internalBodyHash('b'));
    });
  });

  describe('buildInternalSignaturePayload', () => {
    it('joins ts, method, path, bodyHash with colons', () => {
      const result = buildInternalSignaturePayload({
        ts: '1700000000',
        method: 'post',
        path: '/v1/quotes',
        bodyHash: 'abc123',
      });
      expect(result).toBe('1700000000:POST:/v1/quotes:abc123');
    });

    it('uppercases the method', () => {
      const result = buildInternalSignaturePayload({
        ts: '0',
        method: 'get',
        path: '/',
        bodyHash: '',
      });
      expect(result).toContain(':GET:');
    });
  });

  describe('computeInternalSignature', () => {
    it('produces a 64-char hex HMAC-SHA256', () => {
      const sig = computeInternalSignature({
        ts: '1700000000',
        method: 'POST',
        path: '/v1/quotes',
        bodyHash: internalBodyHash('{}'),
        secret: 'test-secret',
      });
      expect(sig).toHaveLength(64);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      const input = {
        ts: '1700000000',
        method: 'POST',
        path: '/v1/quotes',
        bodyHash: 'abc',
        secret: 'secret',
      };
      expect(computeInternalSignature(input)).toBe(computeInternalSignature(input));
    });

    it('differs with different secrets', () => {
      const base = { ts: '1', method: 'POST', path: '/', bodyHash: 'h' };
      const sig1 = computeInternalSignature({ ...base, secret: 's1' });
      const sig2 = computeInternalSignature({ ...base, secret: 's2' });
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('timingSafeHexEqual', () => {
    it('returns true for equal hex strings', () => {
      const hex = 'abcdef0123456789';
      expect(timingSafeHexEqual(hex, hex)).toBe(true);
    });

    it('returns false for different hex strings', () => {
      expect(timingSafeHexEqual('aa', 'bb')).toBe(false);
    });

    it('returns false for different-length hex strings', () => {
      expect(timingSafeHexEqual('aa', 'aabb')).toBe(false);
    });

    it('handles empty strings without throwing', () => {
      expect(timingSafeHexEqual('', '')).toBe(true);
    });
  });
});
