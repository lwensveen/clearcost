import { beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

let transformDates: (v: any) => any;
let dateSerializerPlugin: (typeof import('../date-serializer.js'))['default'];

beforeAll(async () => {
  // Import the module and grab the non-exported helper

  const mod = await import('../date-serializer.js');
  transformDates = mod.transformDates;
  dateSerializerPlugin = mod.default;
});

describe('transformDates (unit)', () => {
  it('converts Date to ISO string at root', () => {
    const d = new Date('2025-09-01T12:34:56.000Z');
    expect(transformDates(d)).toBe('2025-09-01T12:34:56.000Z');
  });

  it('recurses through objects', () => {
    const out = transformDates({
      a: 1,
      when: new Date('2025-01-01T00:00:00.000Z'),
      nested: { when: new Date('2024-12-31T23:59:59.000Z') },
    });
    expect(out).toEqual({
      a: 1,
      when: '2025-01-01T00:00:00.000Z',
      nested: { when: '2024-12-31T23:59:59.000Z' },
    });
  });

  it('recurses through arrays', () => {
    const out = transformDates([
      1,
      new Date('2020-01-02T03:04:05.000Z'),
      { d: new Date('2019-05-06T07:08:09.000Z') },
      [new Date('2018-01-01T00:00:00.000Z')],
    ]);
    expect(out).toEqual([
      1,
      '2020-01-02T03:04:05.000Z',
      { d: '2019-05-06T07:08:09.000Z' },
      ['2018-01-01T00:00:00.000Z'],
    ]);
  });

  it('leaves primitives/null/undefined unchanged', () => {
    expect(transformDates(null)).toBeNull();
    expect(transformDates(undefined)).toBeUndefined();
    expect(transformDates(42)).toBe(42);
    expect(transformDates('x')).toBe('x');
    expect(transformDates(true)).toBe(true);
  });
});

describe('date serializer plugin', () => {
  it('serializes Date fields in HTTP responses via onSend hook', async () => {
    const app = Fastify();
    await app.register(dateSerializerPlugin);
    app.get('/date', async () => ({ when: new Date('2025-01-01T00:00:00.000Z') }));

    const res = await app.inject({ method: 'GET', url: '/date' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ when: '2025-01-01T00:00:00.000Z' });
    await app.close();
  });

  it('logs and throws internalServerError when date transform fails inside hook', async () => {
    const onSendHooks: Array<(req: any, reply: any, payload: any) => Promise<any>> = [];
    const logError = vi.fn();
    const fakeFastify = {
      addHook: (name: string, fn: any) => {
        if (name === 'onSend') onSendHooks.push(fn);
      },
      log: { error: logError },
      httpErrors: {
        internalServerError: (message: string) => {
          const err = new Error(message);
          (err as any).statusCode = 500;
          return err;
        },
      },
    } as any;

    await dateSerializerPlugin(fakeFastify, {});
    expect(onSendHooks).toHaveLength(1);

    const payload: Record<string, unknown> = {};
    Object.defineProperty(payload, 'danger', {
      enumerable: true,
      get() {
        throw new Error('explode');
      },
    });

    const hook = onSendHooks[0]!;
    await expect(hook({ url: '/boom' }, {}, payload)).rejects.toMatchObject({
      message: 'Could not serialize response dates',
      statusCode: 500,
    });
    expect(logError).toHaveBeenCalled();
  });
});
