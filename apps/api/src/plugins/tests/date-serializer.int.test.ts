import { beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import dateSerializerPlugin from '../date-serializer.js';

describe('date-serializer plugin (integration)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(dateSerializerPlugin);

    // JSON route with nested Dates
    app.get('/json', async () => ({
      a: 1,
      when: new Date('2025-09-01T12:34:56.000Z'),
      nested: { b: 2, when: new Date('2024-12-31T23:59:59.000Z') },
      arr: [new Date('2020-01-02T03:04:05.000Z'), { d: new Date('2018-01-01T00:00:00.000Z') }],
    }));

    // Already-serialized JSON string
    app.get('/pre', async (_req: any, reply: any) => {
      const body = JSON.stringify({ when: new Date('2025-09-01T00:00:00.000Z') });
      return reply.type('application/json').send(body);
    });

    // Raw buffer route (should NOT be mutated)
    app.get('/bin', async (_req: any, reply: any) => {
      const buf = Buffer.from('HELLO');
      return reply.type('application/octet-stream').send(buf);
    });
  });

  it('returns JSON with ISO strings for dates', async () => {
    const r = await app.inject({ method: 'GET', url: '/json' });
    expect(r.statusCode).toBe(200);
    const json = r.json();
    // Note: JSON.stringify already converts Date -> ISO; plugin must not break this.
    expect(json.when).toBe('2025-09-01T12:34:56.000Z');
    expect(json.nested.when).toBe('2024-12-31T23:59:59.000Z');
    expect(json.arr[0]).toBe('2020-01-02T03:04:05.000Z');
    expect(json.arr[1].d).toBe('2018-01-01T00:00:00.000Z');
  });

  it('does not change an already-serialized JSON string', async () => {
    const r = await app.inject({ method: 'GET', url: '/pre' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/json/);
    // Body should be a string and remain a valid JSON with ISO string
    expect(r.body).toBe('{"when":"2025-09-01T00:00:00.000Z"}');
  });

  it('does not corrupt binary responses (buffer)', async () => {
    const r = await app.inject({ method: 'GET', url: '/bin' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/octet-stream/);
    // Must remain raw buffer content, not JSON/objectified
    expect(r.body).toBe('HELLO');
  });
});
