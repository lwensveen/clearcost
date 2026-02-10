import { parse } from 'node-html-parser';
import type { DutyRateInsert } from '@clearcost/types';
import { getLatestJpTariffBase, listJpTariffChapterPages } from './etax-source.js';
import { parsePercentAdValorem, toHs6 } from '../../utils/parse.js';
import { httpFetch } from '../../../../lib/http.js';

type FetchOpts = {
  /** Override the dated base (e.g., https://www.customs.go.jp/english/tariff/2025_04_01/index.htm) */
  editionBase?: string;
  /** Optional HS6 filter to limit scope */
  hs6List?: string[];
  /** Optional custom User-Agent */
  userAgent?: string;
  /** Optional override for row effective date */
  effectiveFrom?: Date;
};

export function parseJpEditionEffectiveFrom(editionBaseUrl: string): Date | null {
  const match = editionBaseUrl.match(/\/(\d{4})_(\d{1,2})(?:_(\d{1,2}))?(?:\/|$)/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3] ?? '1');
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
    return null;
  }

  return dt;
}

export async function fetchJpMfnDutyRates(options: FetchOpts = {}): Promise<DutyRateInsert[]> {
  const editionBaseUrl = options.editionBase ?? (await getLatestJpTariffBase());
  const effectiveFrom = options.effectiveFrom ?? parseJpEditionEffectiveFrom(editionBaseUrl);
  if (!effectiveFrom) {
    throw new Error(
      `[JP Duties] Could not derive effectiveFrom from edition base URL: ${editionBaseUrl}`
    );
  }
  const chapterPageUrls = await listJpTariffChapterPages(editionBaseUrl);

  const results: DutyRateInsert[] = [];

  for (const chapterUrl of chapterPageUrls) {
    const response = await httpFetch(chapterUrl, {
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
        effectiveFrom, // edition governs; lines usually lack explicit dates
        effectiveTo: undefined,
        notes: undefined,
        source: 'official',
        currency: undefined,
      });
    }
  }

  return results;
}
