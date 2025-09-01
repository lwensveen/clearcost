import { beforeAll, describe, expect, it } from 'vitest';

let transformDates: (v: any) => any;

beforeAll(async () => {
  // Import the module and grab the non-exported helper

  transformDates = (await import('../date-serializer.js')).transformDates;
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
