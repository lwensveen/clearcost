import { categoriesTable, db, hsCodesTable } from '@clearcost/db';
import { ilike, sql } from 'drizzle-orm';
import type { ClassifyInput } from '@clearcost/types';

// very naive keyword map to start; expand in DB later
const KWD: Array<{ re: RegExp; hs6: string; score: number }> = [
  { re: /\b(antique|vintage|victorian|art deco)\b/i, hs6: '970600', score: 0.7 },
  { re: /\b(violin|fiddle|strad|bowed)\b/i, hs6: '920210', score: 0.6 },
  { re: /\b(figure|figurine|anime|manga|collectible|toy|doll)\b/i, hs6: '950300', score: 0.55 },
];

export async function classifyHS6(input: ClassifyInput) {
  const text = `${input.title} ${input.description ?? ''}`;

  // 1) category hint
  let catHS: string | null = null;
  if (input.categoryKey) {
    const [cat] = await db
      .select({ hs6: categoriesTable.defaultHs6 })
      .from(categoriesTable)
      .where(sql`${categoriesTable.key} = ${input.categoryKey}`)
      .limit(1);
    catHS = cat?.hs6 ?? null;
  }

  // 2) keyword rules
  const scores: Record<string, number> = {};
  for (const { re, hs6, score } of KWD) {
    if (re.test(text)) scores[hs6] = Math.max(scores[hs6] ?? 0, score);
  }

  // 3) fallback fuzzy search in titles
  const words = input.title.split(/\s+/).filter(Boolean);
  if (words.length) {
    const q = words.slice(0, 3).join(' ');
    const hits = await db
      .select({ hs6: hsCodesTable.hs6, title: hsCodesTable.title })
      .from(hsCodesTable)
      .where(ilike(hsCodesTable.title, `%${q}%`))
      .limit(5);

    hits.forEach((h, i) => (scores[h.hs6] = Math.max(scores[h.hs6] ?? 0, 0.45 - i * 0.05)));
  }

  // 4) bias to category if present
  if (catHS) scores[catHS] = Math.max(scores[catHS] ?? 0, 0.65);

  // best candidate
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best] = entries;
  if (!best) {
    // default to toy as lowest risk, tweak later
    return { hs6: '950300', confidence: 0.2, candidates: [] };
  }

  // enrich titles for top-3
  const topHs = entries.slice(0, 3).map(([hs6, score]) => ({ hs6, score }));
  const titles = await db
    .select({ hs6: hsCodesTable.hs6, title: hsCodesTable.title })
    .from(hsCodesTable)
    .where(sql`${hsCodesTable.hs6} IN (${sql.join(topHs.map((t) => t.hs6))})`);

  const candidates = topHs.map((t) => ({
    hs6: t.hs6,
    score: t.score,
    title: titles.find((x) => x.hs6 === t.hs6)?.title ?? '',
  }));
  return { hs6: best[0], confidence: Math.min(0.95, best[1]), candidates };
}
