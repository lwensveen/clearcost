import { parse } from 'node-html-parser';
import type { DutyRateInsert } from '@clearcost/types';
import { getLatestJpTariffBase, listJpTariffChapterPages } from './etax-source.js';
import { parsePercentAdValorem, toHs6 } from '../../utils/parse.js';

type FetchOpts = {
  /** Override the dated base (e.g., https://www.customs.go.jp/english/tariff/2025_1/index.htm) */
  editionBase?: string;
  /** Optional HS6 filter to limit scope */
  hs6List?: string[];
  /** Optional custom User-Agent */
  userAgent?: string;
};

export async function fetchJpMfnDutyRates(options: FetchOpts = {}): Promise<DutyRateInsert[]> {
  const editionBaseUrl = options.editionBase ?? (await getLatestJpTariffBase());
  const chapterPageUrls = await listJpTariffChapterPages(editionBaseUrl);

  const results: DutyRateInsert[] = [];

  for (const chapterUrl of chapterPageUrls) {
    const response = await fetch(chapterUrl, {
      headers: options.userAgent ? { 'user-agent': options.userAgent } : undefined,
      redirect: 'follow',
    });
    if (!response.ok) continue;

    const root = parse(await response.text());

    for (const rowElement of root.querySelectorAll('tr')) {
      const cellElements = rowElement.querySelectorAll('td');
      if (!cellElements || cellElements.length < 2) continue;

      // First cell usually carries the subheading/stat code
      const codeCellText = (cellElements[0]?.innerText ?? '').trim();
      const hs6 = toHs6(codeCellText);
      if (!hs6) continue;

      if (options.hs6List && !options.hs6List.includes(hs6)) continue;

      // Find the first “rate-looking” cell after the code; use shared percent parser
      let ratePctString: string | null = null;
      for (let cellIndex = 1; cellIndex < cellElements.length; cellIndex++) {
        const candidateText = (cellElements[cellIndex]?.innerText ?? '').trim();
        if (!candidateText) continue;

        // maps "FREE" → "0", accepts "5", "5%", "12.5 %", etc.
        const parsed = parsePercentAdValorem(candidateText, { mapFreeToZero: true });
        if (parsed != null) {
          ratePctString = parsed;
          break;
        }
      }
      if (ratePctString == null) continue;

      results.push({
        dest: 'JP',
        partner: '', // MFN sentinel
        hs6,
        dutyRule: 'mfn',
        ratePct: ratePctString,
        effectiveFrom: undefined, // edition governs; lines usually lack explicit dates
        effectiveTo: undefined,
        notes: undefined,
        source: 'official',
        currency: undefined,
      });
    }
  }

  return results;
}
