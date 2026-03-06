import { describe, it, expect } from 'vitest';
import { errorResponse, errorResponseForStatus } from '../errors.js';

describe('errors', () => {
  describe('errorResponse', () => {
    it('returns error envelope with code and message', () => {
      const result = errorResponse('Something went wrong', 'ERR_TEST');
      expect(result).toEqual({
        error: { code: 'ERR_TEST', message: 'Something went wrong' },
      });
    });

    it('uses ERR_REQUEST as default code', () => {
      const result = errorResponse('fail');
      expect(result.error.code).toBe('ERR_REQUEST');
    });

    it('includes details when provided', () => {
      const result = errorResponse('fail', 'ERR_TEST', { field: 'email' });
      expect(result.error.details).toEqual({ field: 'email' });
    });

    it('omits details key when undefined', () => {
      const result = errorResponse('fail');
      expect(result.error).not.toHaveProperty('details');
    });
  });

  describe('errorResponseForStatus', () => {
    it('maps 400 to ERR_BAD_REQUEST', () => {
      const result = errorResponseForStatus(400, 'Bad input');
      expect(result.error.code).toBe('ERR_BAD_REQUEST');
      expect(result.error.message).toBe('Bad input');
    });

    it('maps 401 to ERR_UNAUTHORIZED', () => {
      expect(errorResponseForStatus(401, 'No auth').error.code).toBe('ERR_UNAUTHORIZED');
    });

    it('maps 404 to ERR_NOT_FOUND', () => {
      expect(errorResponseForStatus(404, 'Missing').error.code).toBe('ERR_NOT_FOUND');
    });

    it('maps 409 to ERR_CONFLICT', () => {
      expect(errorResponseForStatus(409, 'Conflict').error.code).toBe('ERR_CONFLICT');
    });

    it('maps 429 to ERR_RATE_LIMITED', () => {
      expect(errorResponseForStatus(429, 'Slow down').error.code).toBe('ERR_RATE_LIMITED');
    });

    it('maps 500 to ERR_INTERNAL', () => {
      expect(errorResponseForStatus(500, 'Boom').error.code).toBe('ERR_INTERNAL');
    });

    it('maps 503 to ERR_UNAVAILABLE', () => {
      expect(errorResponseForStatus(503, 'Down').error.code).toBe('ERR_UNAVAILABLE');
    });

    it('falls back to ERR_REQUEST for unknown status', () => {
      expect(errorResponseForStatus(418, "I'm a teapot").error.code).toBe('ERR_REQUEST');
    });

    it('passes details through', () => {
      const result = errorResponseForStatus(400, 'Bad', { fields: ['name'] });
      expect(result.error.details).toEqual({ fields: ['name'] });
    });
  });
});
