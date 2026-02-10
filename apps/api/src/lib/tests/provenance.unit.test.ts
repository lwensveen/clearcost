import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finishImportRun, heartBeatImportRun, sha256Hex, startImportRun } from '../provenance.js';

const { state, now } = vi.hoisted(() => ({
  state: {
    returningRows: [] as any[],
    lastInsert: null as null | { tbl: any; values: any },
    lastUpdate: null as null | { tbl: any; set: any; where: any },
  },
  now: new Date('2025-01-02T03:04:05.678Z'),
}));

vi.mock('drizzle-orm', () => {
  const sql = (lits: TemplateStringsArray, ...vals: any[]) => {
    let text = '';
    for (let i = 0; i < lits.length; i++) {
      text += lits[i];
      if (i < vals.length) text += `{$${i + 1}}`;
    }
    return { __text: text, __vals: vals };
  };
  const eq = (left: any, right: any) => ({ op: 'eq', left, right });
  return { sql, eq };
});

vi.mock('@clearcost/db', () => {
  const importsTable = {
    id: 'id',
    importSource: 'importSource',
    job: 'job',
    version: 'version',
    sourceUrl: 'sourceUrl',
    params: 'params',
    importStatus: 'importStatus',
    inserted: 'inserted',
    updated: 'updated',
    fileHash: 'fileHash',
    fileBytes: 'fileBytes',
    error: 'error',
    finishedAt: 'finishedAt',
    updatedAt: 'updatedAt',
    versionId: 'versionId',
  } as const;

  const db = {
    insert: (tbl: any) => ({
      values: (vals: any) => {
        state.lastInsert = { tbl, values: vals };
        return {
          returning: () => Promise.resolve(state.returningRows),
        };
      },
    }),
    update: (tbl: any) => ({
      set: (setVals: any) => ({
        where: (wherePred: any) => {
          state.lastUpdate = { tbl, set: setVals, where: wherePred };
          return {
            returning: () => Promise.resolve(state.returningRows),
          };
        },
      }),
    }),
  };

  return { db, importsTable };
});

describe('provenance helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    state.returningRows = [];
    state.lastInsert = null;
    state.lastUpdate = null;
  });

  it('sha256Hex produces expected digest (test vector)', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex(new Uint8Array([0x61, 0x62, 0x63]))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('heartBeatImportRun updates updatedAt with now()', async () => {
    await heartBeatImportRun('run-1');

    expect(state.lastUpdate).not.toBeNull();

    expect(state.lastUpdate!.tbl.id).toBe('id');

    expect(state.lastUpdate!.set.updatedAt).toBeDefined();
    expect(state.lastUpdate!.set.updatedAt.__text).toContain('now()');

    expect(state.lastUpdate!.where).toMatchObject({
      op: 'eq',
      left: 'id',
      right: 'run-1',
    });
  });

  it('startImportRun inserts a running row and returns it; params are JSON stringified; version/sourceUrl default null', async () => {
    const insertedRow = {
      id: 'r1',
      importSource: 'WITS',
      job: 'duties:wits',
      version: null,
      sourceUrl: null,
      params: '{"dests":["SG","MY"]}',
      importStatus: 'running',
    };
    state.returningRows = [insertedRow];

    const res = await startImportRun({
      importSource: 'WITS',
      job: 'duties:wits',
      params: { dests: ['SG', 'MY'] },
    });

    expect(res).toEqual(insertedRow);
    expect(state.lastInsert).not.toBeNull();
    expect(state.lastInsert!.values).toMatchObject({
      importSource: 'WITS',
      job: 'duties:wits',
      version: null,
      sourceUrl: null,
      params: '{"dests":["SG","MY"]}',
      importStatus: 'running',
    });
  });

  it('startImportRun throws if insert returning is empty', async () => {
    state.returningRows = [];
    await expect(startImportRun({ importSource: 'OECD', job: 'vat:auto' })).rejects.toThrow(
      /insert returned no rows/i
    );
  });

  it('finishImportRun patches fields, stamps finishedAt with Date, and returns row', async () => {
    const returned = {
      id: 'r2',
      importStatus: 'succeeded',
      inserted: 3,
      updated: 0,
      version: 'v1',
      sourceUrl: 'https://example.test/source.json',
      fileHash: 'abc123',
      fileBytes: 456,
      error: null,
      finishedAt: new Date(now),
    };
    state.returningRows = [returned];

    const res = await finishImportRun('r2', {
      importStatus: 'succeeded',
      inserted: 3,
      updated: 0,
      version: 'v1',
      sourceUrl: 'https://example.test/source.json',
      fileHash: 'abc123',
      fileBytes: 456,
      error: null,
    });

    expect(res).toEqual(returned);

    // Assert update payload
    expect(state.lastUpdate).not.toBeNull();
    const set = state.lastUpdate!.set;

    expect(set.importStatus).toBe('succeeded');
    expect(set.inserted).toBe(3);
    expect(set.updated).toBe(0);
    expect(set.version).toBe('v1');
    expect(set.sourceUrl).toBe('https://example.test/source.json');
    expect(set.fileHash).toBe('abc123');
    expect(set.fileBytes).toBe(456);

    expect(set.error).toBeUndefined();
    expect(set.finishedAt).toBeInstanceOf(Date);
    expect(state.lastUpdate!.where).toMatchObject({ op: 'eq', left: 'id', right: 'r2' });
  });

  it('finishImportRun throws if update returning is empty', async () => {
    state.returningRows = [];
    await expect(
      finishImportRun('missing-id', { importStatus: 'failed', error: 'boom' })
    ).rejects.toThrow(/update returned no rows/i);
  });

  it('finishImportRun does not set optional fields if they are omitted in patch', async () => {
    state.returningRows = [{ id: 'r3', importStatus: 'failed', error: 'x' }];

    await finishImportRun('r3', { importStatus: 'failed' });

    const set = state.lastUpdate!.set;
    expect(set.inserted).toBeUndefined();
    expect(set.updated).toBeUndefined();
    expect(set.version).toBeUndefined();
    expect(set.sourceUrl).toBeUndefined();
    expect(set.fileHash).toBeUndefined();
    expect(set.fileBytes).toBeUndefined();
    expect(set.error).toBeUndefined();
  });
});
