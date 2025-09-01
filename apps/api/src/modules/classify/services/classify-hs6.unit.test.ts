import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyHS6 } from './classify-hs6.js';

const { state } = vi.hoisted(() => ({
  state: {
    catRows: [] as Array<Array<{ hs6: string }>>,
    hitsRows: [] as Array<Array<{ hs6: string; title: string }>>,
    titlesRows: [] as Array<Array<{ hs6: string; title: string }>>,
  },
}));

vi.mock('drizzle-orm', () => {
  const ilike = (col: any, pattern: string) => ({ __type: 'ilike', col, pattern });
  const sql = ((lits: TemplateStringsArray, ...vals: any[]) => ({
    __type: 'sql',
    __text: String(lits.join('${}')),
    __vals: vals,
  })) as any as typeof import('drizzle-orm').sql;

  (sql as any).join = (chunks: any[], separator?: any) => ({
    __type: 'sql.join',
    chunks,
    separator,
  });

  return { ilike, sql };
});

vi.mock('@clearcost/db', () => {
  const categoriesTable = {
    key: 'key',
    defaultHs6: 'defaultHs6',
  } as const;

  const hsCodesTable = {
    hs6: 'hs6',
    title: 'title',
  } as const;

  const db = {
    select: (sel: any) => ({
      from: (tbl: any) => ({
        where: (cond: any) => {
          if (tbl === categoriesTable) {
            const out = state.catRows.shift() ?? [];
            return {
              limit: async (_n: number) => out,
            };
          }

          if (tbl === hsCodesTable) {
            if (cond && cond.__type === 'ilike') {
              const out = state.hitsRows.shift() ?? [];
              return {
                limit: async (_n: number) => out,
              };
            } else {
              const out = state.titlesRows.shift() ?? [];
              return Promise.resolve(out);
            }
          }

          return { limit: async () => [] };
        },
      }),
    }),
  };

  return { db, categoriesTable, hsCodesTable };
});

describe('classifyHS6', () => {
  beforeEach(() => {
    state.catRows = [];
    state.hitsRows = [];
    state.titlesRows = [];
  });

  it('applies keyword rules and category bias; returns enriched titles', async () => {
    state.catRows.push([{ hs6: '970600' }]);
    state.hitsRows.push([]);
    state.titlesRows.push([
      { hs6: '970600', title: 'Antiques and Collectors’ items' },
      { hs6: '920210', title: 'Violins' },
    ]);

    const r = await classifyHS6({
      title: 'Vintage violin figurine',
      description: '',
      categoryKey: 'cat-antique',
    });

    expect(r.hs6).toBe('970600');
    expect(r.confidence).toBeCloseTo(0.7, 6);

    expect(r.candidates[0]).toMatchObject({
      hs6: '970600',
      title: 'Antiques and Collectors’ items',
    });
    expect(r.candidates.some((c) => c.hs6 === '920210')).toBe(true);
  });

  it('uses fuzzy fallback when no keywords/category; scores decay by hit rank; enriches titles', async () => {
    state.hitsRows.push([
      { hs6: '111111', title: 'Super Mega Widget' },
      { hs6: '222222', title: 'Another Super Widget' },
      { hs6: '333333', title: 'Widget-ish Thing' },
    ]);
    state.titlesRows.push([
      { hs6: '111111', title: 'Super Mega Widget' },
      { hs6: '222222', title: 'Another Super Widget' },
      { hs6: '333333', title: 'Widget-ish Thing' },
    ]);

    const r = await classifyHS6({
      title: 'Super Mega Widget',
      description: '',
    });

    expect(r.hs6).toBe('111111');
    expect(r.confidence).toBeCloseTo(0.45, 6);
    expect(r.candidates.map((c) => c.hs6)).toEqual(['111111', '222222', '333333']);
    expect(r.candidates[0]!.title).toBe('Super Mega Widget');
  });

  it('category bias wins over weaker fuzzy hits when keywords absent', async () => {
    state.catRows.push([{ hs6: '920210' }]);
    state.hitsRows.push([{ hs6: '999999', title: 'Some HS title' }]);
    state.titlesRows.push([
      { hs6: '920210', title: 'Violins' },
      { hs6: '999999', title: 'Some HS title' },
    ]);

    const r = await classifyHS6({
      title: 'Unrelated words',
      description: '',
      categoryKey: 'music',
    });

    expect(r.hs6).toBe('920210');
    expect(r.confidence).toBeCloseTo(0.65, 6);
    expect(r.candidates.some((c) => c.hs6 === '920210' && c.title === 'Violins')).toBe(true);
  });

  it('defaults to 950300 @ 0.2 with no candidates when nothing matches and no words', async () => {
    const r = await classifyHS6({
      title: '',
      description: '',
    });

    expect(r).toEqual({
      hs6: '950300',
      confidence: 0.2,
      candidates: [],
    });
  });
});
