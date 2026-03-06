import { describe, it, expect } from 'vitest';
import { rateLimitHeaders, withRateLimit } from '../schema-helpers.js';

describe('schema-helpers', () => {
  describe('rateLimitHeaders', () => {
    it('defines Limit, Remaining, and Reset headers', () => {
      expect(rateLimitHeaders).toHaveProperty('RateLimit-Limit');
      expect(rateLimitHeaders).toHaveProperty('RateLimit-Remaining');
      expect(rateLimitHeaders).toHaveProperty('RateLimit-Reset');
    });
  });

  describe('withRateLimit', () => {
    it('adds rate limit headers to each response code', () => {
      const schema = {
        response: {
          200: { description: 'OK' },
          400: { description: 'Bad Request' },
        },
      };
      const result = withRateLimit(schema);

      expect(result.response!['200']!.headers).toEqual(
        expect.objectContaining({ 'RateLimit-Limit': expect.any(Object) })
      );
      expect(result.response!['400']!.headers).toEqual(
        expect.objectContaining({ 'RateLimit-Remaining': expect.any(Object) })
      );
    });

    it('preserves existing headers', () => {
      const schema = {
        response: {
          200: { description: 'OK', headers: { 'X-Custom': { schema: { type: 'string' } } } },
        },
      };
      const result = withRateLimit(schema);

      expect(result.response!['200']!.headers!['X-Custom']).toEqual({ schema: { type: 'string' } });
      expect(result.response!['200']!.headers!['RateLimit-Limit']).toBeDefined();
    });

    it('handles schema without response key', () => {
      const schema = { body: { type: 'object' } };
      const result = withRateLimit(schema);

      expect(result.body).toEqual({ type: 'object' });
      expect(result.response).toEqual({});
    });

    it('preserves non-response schema properties', () => {
      const schema = {
        body: { type: 'object' },
        querystring: { type: 'object' },
        response: { 200: { description: 'OK' } },
      };
      const result = withRateLimit(schema);

      expect(result.body).toEqual({ type: 'object' });
      expect(result.querystring).toEqual({ type: 'object' });
    });
  });
});
