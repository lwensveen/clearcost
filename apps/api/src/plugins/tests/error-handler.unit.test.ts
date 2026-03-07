import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import errorHandler from '../error-handler.js';

async function makeApp() {
  const app = Fastify();
  await app.register(errorHandler);
  return app;
}

describe('errorHandler plugin (unit)', () => {
  // ─── 4xx errors ───────────────────────────────────────────────────

  it('returns 400 with original message for bad-request errors', async () => {
    const app = await makeApp();
    app.get('/bad', async () => {
      const err = new Error('Missing required field') as FastifyError;
      err.statusCode = 400;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.message).toBe('Missing required field');
    await app.close();
  });

  it('returns 401 with original message for unauthorized errors', async () => {
    const app = await makeApp();
    app.get('/unauth', async () => {
      const err = new Error('Invalid API key') as FastifyError;
      err.statusCode = 401;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/unauth' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Invalid API key');
    await app.close();
  });

  it('returns 403 with original message for forbidden errors', async () => {
    const app = await makeApp();
    app.get('/forbidden', async () => {
      const err = new Error('Insufficient permissions') as FastifyError;
      err.statusCode = 403;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/forbidden' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toBe('Insufficient permissions');
    await app.close();
  });

  it('returns 404 with original message for not-found errors', async () => {
    const app = await makeApp();
    app.get('/missing', async () => {
      const err = new Error('Resource not found') as FastifyError;
      err.statusCode = 404;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.message).toBe('Resource not found');
    await app.close();
  });

  it('preserves custom error code for 4xx errors', async () => {
    const app = await makeApp();
    app.get('/custom-code', async () => {
      const err = new Error('Rate limited') as FastifyError & { code: string };
      err.statusCode = 429;
      err.code = 'ERR_RATE_LIMIT';
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/custom-code' });
    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error.code).toBe('ERR_RATE_LIMIT');
    expect(body.error.message).toBe('Rate limited');
    await app.close();
  });

  it('uses ERR_UNEXPECTED when 4xx error has no code', async () => {
    const app = await makeApp();
    app.get('/no-code', async () => {
      const err = new Error('Something wrong') as FastifyError;
      err.statusCode = 422;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/no-code' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('ERR_UNEXPECTED');
    await app.close();
  });

  // ─── 5xx errors ───────────────────────────────────────────────────

  it('returns 500 with generic message for internal errors', async () => {
    const app = await makeApp();
    app.get('/crash', async () => {
      const err = new Error('database connection pool exhausted') as FastifyError;
      err.statusCode = 500;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/crash' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.code).toBe('ERR_INTERNAL');
    await app.close();
  });

  it('returns 502 with generic message and ERR_INTERNAL code', async () => {
    const app = await makeApp();
    app.get('/upstream', async () => {
      const err = new Error('upstream timed out') as FastifyError;
      err.statusCode = 502;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/upstream' });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.code).toBe('ERR_INTERNAL');
    await app.close();
  });

  it('redacts 5xx error code to ERR_INTERNAL even if original code is set', async () => {
    const app = await makeApp();
    app.get('/redact', async () => {
      const err = new Error('secret leak') as FastifyError & { code: string };
      err.statusCode = 503;
      err.code = 'ERR_DB_POOL';
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/redact' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('ERR_INTERNAL');
    await app.close();
  });

  it('defaults to 500 for errors with no statusCode', async () => {
    const app = await makeApp();
    app.get('/bare', async () => {
      throw new Error('unexpected failure');
    });

    const res = await app.inject({ method: 'GET', url: '/bare' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.code).toBe('ERR_INTERNAL');
    await app.close();
  });

  // ─── alternate status field ────────────────────────────────────────

  it('reads .status property when .statusCode is absent', async () => {
    const app = await makeApp();
    app.get('/alt-status', async () => {
      const err = new Error('Not acceptable') as any;
      err.status = 406;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/alt-status' });
    expect(res.statusCode).toBe(406);
    expect(res.json().error.message).toBe('Not acceptable');
    await app.close();
  });

  // ─── out-of-range status codes ─────────────────────────────────────

  it('clamps invalid status codes to 500', async () => {
    const app = await makeApp();
    app.get('/bad-status', async () => {
      const err = new Error('weird') as any;
      err.statusCode = 999;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/bad-status' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('ERR_INTERNAL');
    await app.close();
  });

  // ─── empty error message ──────────────────────────────────────────

  it('uses "Unexpected error" when 4xx error has empty message', async () => {
    const app = await makeApp();
    app.get('/empty-msg', async () => {
      const err = new Error('') as FastifyError;
      err.statusCode = 400;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/empty-msg' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unexpected error');
    await app.close();
  });

  // ─── response shape ───────────────────────────────────────────────

  it('always returns { error: { code, message } } shape', async () => {
    const app = await makeApp();
    app.get('/shape', async () => {
      throw new Error('boom');
    });

    const res = await app.inject({ method: 'GET', url: '/shape' });
    const body = res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
    await app.close();
  });
});
