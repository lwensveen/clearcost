import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildImportId,
  ensureDate,
  fetchJSON,
  flagBool,
  flagCSV,
  flagNum,
  flagStr,
  parseCSV,
  parseFlags,
  toDateOrNull,
  toNumeric3String,
  USER_AGENT,
} from './utils.js';

describe('fetchJSON', () => {
  const origFetch = globalThis.fetch;

  function setFetchMock(impl: (url: string, init?: RequestInit) => Promise<any>): {
    mock: ReturnType<typeof vi.fn> & Partial<typeof fetch>;
  } {
    const mock = vi.fn(impl) as any;
    mock.preconnect = vi.fn(async (_url: string) => {});
    globalThis.fetch = mock as unknown as typeof fetch;
    return { mock };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it('sends USER_AGENT and returns parsed JSON on ok', async () => {
    const payload = { ok: true, n: 1 };
    const { mock } = setFetchMock(async (_url: string, init?: RequestInit) => {
      // assert header was sent
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['user-agent']).toBe(USER_AGENT);
      return {
        ok: true,
        json: async () => payload,
      };
    });

    const out = await fetchJSON<typeof payload>('https://example.test/x');
    expect(out).toEqual(payload);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('throws with status, statusText and body when !ok', async () => {
    setFetchMock(async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'boom',
      };
    });

    await expect(fetchJSON('https://example.test/fail')).rejects.toThrow(
      /Fetch failed 500 Internal Server Error – boom/
    );
  });
});

describe('toNumeric3String', () => {
  it('formats with 3 decimals and keeps non-zero sign', () => {
    expect(toNumeric3String(1)).toBe('1.000');
    expect(toNumeric3String(1.23456)).toBe('1.235');
    expect(toNumeric3String('2')).toBe('2.000');
    expect(toNumeric3String(123.9994)).toBe('123.999');
    expect(toNumeric3String(123.9996)).toBe('124.000');
  });

  it('normalizes +/-0 to "0.000"', () => {
    expect(toNumeric3String(0)).toBe('0.000');
    expect(toNumeric3String(-0.0001)).toBe('0.000');
  });

  it('throws on non-finite', () => {
    expect(() => toNumeric3String(NaN)).toThrow(/not a finite number/);
    expect(() => toNumeric3String(Infinity)).toThrow(/not a finite number/);
  });
});

describe('date helpers', () => {
  it('toDateOrNull', () => {
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull(null)).toBeNull();
    const d = toDateOrNull('2020-01-02T03:04:05.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2020-01-02T03:04:05.000Z');
  });

  it('ensureDate returns Date for valid and throws for invalid', () => {
    const d = ensureDate('2025-01-02T00:00:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe('2025-01-02T00:00:00.000Z');

    expect(() => ensureDate('not-a-date', 'shipDate')).toThrow(/Invalid shipDate: not-a-date/);
  });
});

describe('parseCSV', () => {
  it('splits, trims, filters empties', () => {
    expect(parseCSV(undefined)).toEqual([]);
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('a, b , , c ,')).toEqual(['a', 'b', 'c']);
  });
});

describe('flags parsing & accessors', () => {
  it('parseFlags handles --k=v and bare --k', () => {
    const flags = parseFlags(['--a=1', '--b', 'positional', '--empty=   ', '--c=hello']);
    // values are strings
    expect(flags).toEqual({ a: '1', b: 'true', empty: '', c: 'hello' });
  });

  it('parseFlags ignores non --* tokens and keeps last occurrence', () => {
    const flags = parseFlags(['a=1', '-x', '--k=1', '--k=2']);
    expect(flags.k).toBe('2');
    expect(flags).not.toHaveProperty('a');
  });

  it('flagStr trims and returns undefined for empty/whitespace', () => {
    const f = { a: ' x ', b: '', c: '   ' } as const;
    expect(flagStr(f, 'a')).toBe('x');
    expect(flagStr(f, 'b')).toBeUndefined();
    expect(flagStr(f, 'c')).toBeUndefined();
    expect(flagStr(f, 'missing')).toBeUndefined();
  });

  it('flagBool accepts true-ish variants, otherwise false', () => {
    const f = parseFlags(['--t1=true', '--t2=1', '--t3=YES', '--t4=on', '--f1=false', '--f2=0']);
    expect(flagBool(f, 't1')).toBe(true);
    expect(flagBool(f, 't2')).toBe(true);
    expect(flagBool(f, 't3')).toBe(true);
    expect(flagBool(f, 't4')).toBe(true);

    expect(flagBool(f, 'f1')).toBe(false);
    expect(flagBool(f, 'f2')).toBe(false);
    expect(flagBool({}, 'missing')).toBe(false);
  });

  it('flagNum parses finite numbers; NaN → undefined', () => {
    const f = parseFlags(['--n1=42', '--n2=3.14', '--bad=NaN', '--ws=   ']);
    expect(flagNum(f, 'n1')).toBe(42);
    expect(flagNum(f, 'n2')).toBeCloseTo(3.14);
    expect(flagNum(f, 'bad')).toBeUndefined();
    expect(flagNum(f, 'ws')).toBeUndefined();
    expect(flagNum({}, 'missing')).toBeUndefined();
  });

  it('flagCSV splits on commas/whitespace and filters empties', () => {
    const f = parseFlags(['--list=a,b c', '--more=  x,  y ,   z  ']);
    expect(flagCSV(f, 'list')).toEqual(['a', 'b', 'c']);
    expect(flagCSV(f, 'more')).toEqual(['x', 'y', 'z']);
    expect(flagCSV({}, 'none')).toEqual([]);
  });
});

describe('buildImportId', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-06T07:08:09.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes kind and ISO timestamp; appends non-empty parts', () => {
    const id = buildImportId('duty', ['US', 2020, undefined]);
    expect(id).toBe('duty:US:2020:2025-05-06T07:08:09.000Z');
  });

  it('omits suffix if parts are empty/falsy', () => {
    const id = buildImportId('job', [undefined, '', 0]);
    expect(id).toBe('job:2025-05-06T07:08:09.000Z');
  });
});
