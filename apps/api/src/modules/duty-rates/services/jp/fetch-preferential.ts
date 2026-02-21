import { type HTMLElement, parse } from 'node-html-parser';
import type { DutyRateInsert } from '@clearcost/types';
import { getLatestJpTariffBase, listJpTariffChapterPages } from './etax-source.js';
import { parseJpEditionEffectiveFrom } from './fetch-mfn.js';
import { normalizePartnerLabel, parsePercentAdValorem, toHs6 } from '../../utils/parse.js';
import { httpFetch } from '../../../../lib/http.js';

type FetchOpts = {
  editionBase?: string;
  hs6List?: string[];
  partnerGeoIds?: string[];
  userAgent?: string;
  effectiveFrom?: Date;
};

const NON_PARTNER_HEADER_HINTS = [
  'MFN',
  'WTO',
  'GENERAL',
  'BASIC',
  'TEMP',
  'PROVISIONAL',
  'GSP',
  'LDC',
  'SPECIAL',
];

function normalizePartnerFilter(partnerGeoIds?: string[]): Set<string> | null {
  if (!partnerGeoIds || partnerGeoIds.length === 0) return null;
  const out = new Set<string>();
  for (const partner of partnerGeoIds) {
    const normalized = String(partner ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) continue;
    out.add(normalized);
  }
  return out.size > 0 ? out : null;
}

function normalizeHeaderText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function partnerFromHeader(header: string): string | null {
  const normalized = normalizeHeaderText(header);
  if (!normalized) return null;
  const upper = normalized.toUpperCase();

  if (NON_PARTNER_HEADER_HINTS.some((hint) => upper.includes(hint))) {
    return null;
  }

  const mapped = normalizePartnerLabel(normalized);
  if (mapped && /^[A-Z]{2}$/.test(mapped)) return mapped;

  const codeMatch = upper.match(/\b([A-Z]{2})\b/);
  if (codeMatch?.[1] && /^[A-Z]{2}$/.test(codeMatch[1])) return codeMatch[1];

  return null;
}

function resolveHeaderRow(tableRows: HTMLElement[]): string[] {
  for (const row of tableRows) {
    if (!('querySelectorAll' in row)) continue;
    const thCells = row.querySelectorAll('th');
    if (thCells.length >= 2) {
      return thCells.map((th) => normalizeHeaderText(th.textContent));
    }
  }
  return [];
}

export async function fetchJpPreferentialDutyRates(
  options: FetchOpts = {}
): Promise<DutyRateInsert[]> {
  const editionBaseUrl = options.editionBase ?? (await getLatestJpTariffBase());
  const effectiveFrom = options.effectiveFrom ?? parseJpEditionEffectiveFrom(editionBaseUrl);
  if (!effectiveFrom) {
    throw new Error(
      `[JP Duties] Could not derive effectiveFrom from edition base URL: ${editionBaseUrl}`
    );
  }

  const hs6Filter = options.hs6List ? new Set(options.hs6List) : null;
  const partnerFilter = normalizePartnerFilter(options.partnerGeoIds);
  const chapterPageUrls = await listJpTariffChapterPages(editionBaseUrl);
  const rows: DutyRateInsert[] = [];
  const dedupe = new Set<string>();

  for (const chapterUrl of chapterPageUrls) {
    const response = await httpFetch(chapterUrl, {
      headers: options.userAgent ? { 'user-agent': options.userAgent } : undefined,
      redirect: 'follow',
    });
    if (!response.ok) continue;

    const root = parse(await response.text());
    const tables = root.querySelectorAll('table');
    if (tables.length === 0) continue;

    for (const table of tables) {
      const tableRows = table.querySelectorAll('tr');
      const headerLabels = resolveHeaderRow(tableRows);
      const partnersByColumn = new Map<number, string>();

      for (let index = 1; index < headerLabels.length; index++) {
        const partner = partnerFromHeader(headerLabels[index] ?? '');
        if (!partner) continue;
        partnersByColumn.set(index, partner);
      }

      if (partnersByColumn.size === 0) continue;

      for (const row of tableRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const hs6 = toHs6(cells[0]?.textContent);
        if (!hs6) continue;
        if (hs6Filter && !hs6Filter.has(hs6)) continue;

        for (let columnIndex = 1; columnIndex < cells.length; columnIndex++) {
          const partner = partnersByColumn.get(columnIndex);
          if (!partner) continue;
          if (partnerFilter && !partnerFilter.has(partner)) continue;

          const ratePct = parsePercentAdValorem(cells[columnIndex]?.textContent, {
            mapFreeToZero: true,
          });
          if (ratePct == null) continue;

          const key = `${partner}:${hs6}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);

          rows.push({
            dest: 'JP',
            partner,
            hs6,
            dutyRule: 'fta',
            ratePct,
            effectiveFrom,
            effectiveTo: null,
            notes: undefined,
            source: 'official',
            currency: undefined,
          });
        }
      }
    }
  }

  return rows;
}
