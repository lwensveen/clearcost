import { db, hsCodeAliasesTable } from '@clearcost/db';
import { exportChapterJson } from '../../../duty-rates/services/us/hts-base.js';

export type ImportUsHts10AliasesResult = { ok: true; count: number };

/** Extract 10-digit code (digits only) from a row; return { code10, title }. */
function parseHts10AndTitle(
  row: Record<string, unknown>
): { code10: string; title: string } | null {
  const codeCandidate =
    (row['hts10'] as string) ??
    (row['htsno'] as string) ??
    (row['htsno10'] as string) ??
    (row['hts_number'] as string);
  const titleCandidate =
    (row['description'] as string) ??
    (row['desc'] as string) ??
    (row['articleDescription'] as string);

  const code10 = String(codeCandidate ?? '').replace(/\D+/g, '');
  if (!/^\d{10}$/.test(code10)) return null;

  const title = String(titleCandidate ?? '').trim() || '—';
  return { code10, title };
}

function hs6(code10: string) {
  return code10.slice(0, 6);
}

export async function importUsHts10Aliases(): Promise<ImportUsHts10AliasesResult> {
  const chapters = Array.from({ length: 97 }, (_, i) => i + 1);

  let inserted = 0;
  const batch: { hs6: string; system: 'HTS10'; code: string; title: string }[] = [];

  const flush = async () => {
    if (!batch.length) return;
    await db.transaction(async (trx) => {
      const ret = await trx
        .insert(hsCodeAliasesTable)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: hsCodeAliasesTable.id });
      inserted += ret.length;
    });
    batch.length = 0;
  };

  for (const ch of chapters) {
    const rows = await exportChapterJson(ch).catch(() => [] as Record<string, unknown>[]);
    for (const row of rows) {
      const parsed = parseHts10AndTitle(row);
      if (!parsed) continue;

      batch.push({
        hs6: hs6(parsed.code10),
        system: 'HTS10',
        code: parsed.code10,
        title: parsed.title,
      });

      if (batch.length >= 2000) await flush();
    }
  }

  await flush();
  return { ok: true as const, count: inserted };
}
