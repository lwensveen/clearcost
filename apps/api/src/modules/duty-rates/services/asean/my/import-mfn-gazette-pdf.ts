import pdf from 'pdf-parse';
import { batchUpsertDutyRatesFromStream } from '../../../utils/batch-upsert.js';
import { parsePercentAdValorem, toHs6 } from '../../../utils/parse.js';
import { httpFetch } from '../../../../../lib/http.js';

type ImportPdfOptions = {
  url: string;
  importId?: string;
  batchSize?: number;
  dryRun?: boolean;
};

function extractHs6FromLine(line: string): string | null {
  // Examples that should match:
  //   0101.21.00
  //   0101.21
  //   01012100
  const codeMatch = /(\d{2}\.\d{2}\.\d{2}(?:\.\d{2})?|\d{6,10})/.exec(line);
  if (!codeMatch?.[1]) return null;
  return toHs6(codeMatch[1]);
}

function extractAdValoremPctFromLine(line: string): string | null {
  // First try robust parser (handles "FREE", "0%", "5 %", etc.)
  const viaHelper = parsePercentAdValorem(line, { mapFreeToZero: true });
  if (viaHelper != null) return viaHelper;

  // Fallback: look for a bare number on the line when there is no '%' present
  const bareNumber = /\b(\d+(?:\.\d+)?)\b(?!.*%)/.exec(line);
  return bareNumber?.[1] ?? null;
}

export async function importMyMfnFromGazettePdf(options: ImportPdfOptions) {
  const response = await httpFetch(options.url, { redirect: 'follow', timeoutMs: 60000 });
  if (!response.ok) throw new Error(`MY Gazette PDF download failed ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const parsed = await pdf(buffer);
  const lines = String(parsed.text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Collect raw (hs6, ratePct) rows from text lines
  const parsedRows: Array<{ hs6: string; ratePct: string }> = [];
  for (const line of lines) {
    const hs6 = extractHs6FromLine(line);
    if (!hs6) continue;

    const ratePct = extractAdValoremPctFromLine(line);
    if (!ratePct) continue;

    parsedRows.push({ hs6, ratePct });
  }

  // De-duplicate: keep the lowest rate seen per HS6
  const lowestByHs6 = new Map<string, string>();
  for (const row of parsedRows) {
    const previous = lowestByHs6.get(row.hs6);
    if (previous == null || Number(row.ratePct) < Number(previous)) {
      lowestByHs6.set(row.hs6, row.ratePct);
    }
  }

  const upserts = Array.from(lowestByHs6, ([hs6, ratePct]) => ({
    dest: 'MY',
    partner: '', // MFN sentinel
    hs6,
    dutyRule: 'mfn' as const,
    ratePct,
    currency: undefined,
    notes: undefined,
    source: 'official' as const,
  }));

  return batchUpsertDutyRatesFromStream(upserts, {
    batchSize: options.batchSize ?? 2_000,
    dryRun: options.dryRun,
    importId: options.importId,
    source: 'official',
    makeSourceRef: (row) => `my:gazette/mfn:${row.hs6}`,
  });
}
