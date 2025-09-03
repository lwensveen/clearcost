import { beforeEach, describe, expect, it, vi } from 'vitest';
import { issueApiKey } from './issue-api-key.js';

const { state, gen } = vi.hoisted(() => {
  type Row = { id: string; createdAt: Date };

  const state: {
    lastVals: any;
    returningRows: Row[];
  } = {
    lastVals: null,
    returningRows: [{ id: 'row-1', createdAt: new Date('2025-02-03T00:00:00.000Z') }],
  };

  const gen = {
    fn: vi.fn(async (prefix: 'live' | 'test' = 'live') => ({
      token: `ck_${prefix}_kid-123.SECRET`,
      keyId: 'kid-123',
      tokenPhc: '$scrypt$ln=15,r=8,p=1$QUFBQUE$QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=',
      prefix,
    })),
  };

  return { state, gen };
});

vi.mock('@clearcost/db', () => {
  const apiKeysTable = {
    id: 'id',
    createdAt: 'createdAt',
    keyId: 'keyId',
    prefix: 'prefix',
    name: 'name',
    ownerId: 'ownerId',
    tokenPhc: 'tokenPhc', // updated schema field
    scopes: 'scopes',
    isActive: 'isActive',
    expiresAt: 'expiresAt',
  } as const;

  const db = {
    insert: (_tbl: any) => ({
      values: (vals: any) => {
        state.lastVals = vals;
        return {
          returning: async (_sel: any) => {
            const row = state.returningRows.shift();
            return row ? [row] : [];
          },
        };
      },
    }),
  };

  return { db, apiKeysTable };
});

vi.mock('../../../plugins/api-key-auth.js', () => ({
  generateApiKey: gen.fn,
}));

describe('issueApiKey (unit)', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    state.lastVals = null;
    state.returningRows = [{ id: 'row-1', createdAt: new Date('2025-02-03T00:00:00.000Z') }];
    gen.fn.mockClear();
  });

  it('inserts PHC token and returns row data', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');

    const out = await issueApiKey({
      ownerId: 'owner-1',
      name: 'My Key',
      scopes: ['read', 'write'],
      prefix: 'test',
      expiresAt,
    });

    expect(gen.fn).toHaveBeenCalledWith('test');

    const v: any = state.lastVals!;
    expect(v.ownerId).toBe('owner-1');
    expect(v.name).toBe('My Key');
    expect(v.keyId).toBe('kid-123');
    expect(v.prefix).toBe('test');
    expect(v.tokenPhc).toMatch(/^\$scrypt\$/); // stored PHC string
    expect(v.scopes).toEqual(['read', 'write']);
    expect(v.isActive).toBe(true);
    expect(new Date(v.expiresAt).getTime()).toBe(expiresAt.getTime());

    expect(out).toMatchObject({
      id: 'row-1',
      token: 'ck_test_kid-123.SECRET',
      keyId: 'kid-123',
      prefix: 'test',
      name: 'My Key',
      ownerId: 'owner-1',
      scopes: ['read', 'write'],
      isActive: true,
    });

    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.createdAt!.toISOString()).toBe('2025-02-03T00:00:00.000Z');
  });

  it('sets expiresAt to null when omitted and defaults prefix "live"', async () => {
    const out = await issueApiKey({
      ownerId: 'o2',
      name: 'Second',
      scopes: ['read'],
    });

    expect(gen.fn).toHaveBeenCalledWith('live');

    const v: any = state.lastVals!;
    expect(v.prefix).toBe('live');
    expect(v.expiresAt).toBeNull();

    expect(out.prefix).toBe('live');
    expect(out.scopes).toEqual(['read']);
  });

  it('throws when insert returns no rows', async () => {
    state.returningRows = [];
    await expect(issueApiKey({ ownerId: 'o', name: 'NoRow', scopes: [] })).rejects.toThrow(
      /Failed to create API key/
    );
  });
});
