import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import plugin from '../swagger.js';

describe('swagger plugin (integration)', () => {
  it('serves OpenAPI JSON and Swagger UI', async () => {
    const app = Fastify();
    await app.register(plugin);

    const r1 = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(r1.statusCode).toBe(200);
    const doc = r1.json();
    expect(doc?.openapi || doc?.swagger).toBeTruthy();
    expect(doc?.info?.title).toBe('clearcost-API');
    expect(doc?.info?.version).toBe('0.1.0');

    const r2 = await app.inject({ method: 'GET', url: '/docs' });
    if (r2.statusCode === 301 || r2.statusCode === 302) {
      const r3 = await app.inject({ method: 'GET', url: '/docs/' });
      expect(r3.statusCode).toBe(200);
      expect(r3.headers['content-type']).toMatch(/text\/html/);
      expect(r3.body).toMatch(/Swagger UI/i);
    } else {
      expect(r2.statusCode).toBe(200);
      expect(r2.headers['content-type']).toMatch(/text\/html/);
      expect(r2.body).toMatch(/Swagger UI/i);
    }

    await app.close();
  });
});
