import { db, hsCodeAliasesTable } from '@clearcost/db';
import {
  cell,
  fetchTableCsvStream,
  headerIndex,
  iterateCsvRecords,
} from '../../../duty-rates/utils/stream-csv.js';
import { getLatestVersionId } from '../../../duty-rates/services/uk/base.js';

function onlyDigits(s: string) {
  return s.replace(/\D+/g, '');
}
function isUk10(s: string) {
  return /^\d{10}$/.test(s);
}

export async function importUk10Aliases() {
  const versionId = await getLatestVersionId();
  const stream = await fetchTableCsvStream(versionId);

  let isHeader = true;
  let idxCode = -1,
    idxDesc = -1;

  const batch: { hs6: string; code: string; title: string }[] = [];
  const flush = async () => {
    if (!batch.length) return;
    await db.transaction(async (trx) => {
      for (const r of batch) {
        await trx
          .insert(hsCodeAliasesTable)
          .values({ hs6: r.hs6, system: 'UK10', code: r.code, title: r.title } as any)
          .onConflictDoNothing();
      }
    });
    batch.length = 0;
  };

  for await (const rec of iterateCsvRecords(stream)) {
    if (isHeader) {
      const { idx } = headerIndex(rec);
      idxCode = idx('commodity__code');
      idxDesc =
        idx('description') ??
        idx('goods_nomenclature__item__description') ??
        idx('geographical_area__description');
      isHeader = false;
      continue;
    }
    const codeRaw = onlyDigits(cell(rec, idxCode) || '');
    if (!isUk10(codeRaw)) continue;

    const title = (cell(rec, idxDesc) || '').trim() || '—';
    batch.push({ hs6: codeRaw.slice(0, 6), code: codeRaw, title });
    if (batch.length >= 2000) await flush();
  }

  await flush();
  return { ok: true as const };
}
