import { importDeMinimis } from './import-de-minimis.js';
import type { DeMinimisInsert } from '@clearcost/types';
import { httpFetch } from '../../../lib/http.js';

const API_BASE = 'https://api.trade.gov/v1/de_minimis/search';

type TradeGovItem = {
  country: string; // ISO-2 (e.g. "CA")
  country_name: string;
  de_minimis_value?: number | string | null;
  de_minimis_currency?: string | null; // ISO-4217 (e.g. "CAD")
  vat_amount?: number | string | null;
  vat_currency?: string | null; // ISO-4217
  notes?: string | null;
};

type TradeGovResp = {
  total?: number;
  results?: TradeGovItem[];
  size?: number;
  offset?: number;
  search_performed_at?: string;
  sources_used?: Array<{
    source?: string;
    source_last_updated?: string;
    last_imported?: string;
  }>;
};

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));
const numStr = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? String(n) : null;
};

/**
 * Imports De Minimis (DUTY) and VAT thresholds from Trade.gov (ITA).
 * Docs: https://internationaltradeadministration.github.io/developerportal/de-minimis.html
 *
 * Notes:
 *  - This dataset focuses on foreign markets; anomalies are possible (e.g., US row).
 *  - We default deMinimisBasis to INTRINSIC; curate CIF overrides later if needed.
 */
export async function importDeMinimisFromTradeGov(
  effectiveOn?: Date,
  opts: { importId?: string } = {}
) {
  const apiKey = process.env.TRADE_GOV_API_KEY || '';
  const effectiveFrom = toMidnightUTC(effectiveOn ?? new Date());

  const rows: DeMinimisInsert[] = [];
  const size = 100;
  let offset = 0;

  // Page until exhausted
  while (true) {
    const url = new URL(API_BASE);
    url.searchParams.set('size', String(size));
    url.searchParams.set('offset', String(offset));
    if (apiKey) url.searchParams.set('api_key', apiKey);

    const r = await httpFetch(url.toString(), { headers: { 'user-agent': 'clearcost-importer' } });
    if (!r.ok) throw new Error(`Trade.gov de_minimis fetch ${r.status}`);

    const data: TradeGovResp = await r.json();
    const items = data.results ?? [];
    if (items.length === 0) break;

    for (const it of items) {
      const dest = (it.country || '').toUpperCase();
      if (dest.length !== 2) continue;

      const push = (
        kind: DeMinimisInsert['deMinimisKind'],
        value: unknown,
        currency: string | null | undefined
      ) => {
        const v = numStr(value);
        const cur = currency?.toUpperCase() || null;
        if (!v || !cur) return;
        rows.push({
          dest,
          deMinimisKind: kind,
          deMinimisBasis: 'INTRINSIC', // placeholder; override per country later if needed
          currency: cur,
          value: v,
          effectiveFrom,
          effectiveTo: null,
        });
      };

      push('DUTY', it.de_minimis_value, it.de_minimis_currency);
      push('VAT', it.vat_amount, it.vat_currency);
    }

    offset += items.length;
    if (items.length < size) break;
  }

  if (rows.length === 0) return { ok: true as const, inserted: 0, updated: 0, count: 0 };

  const res = await importDeMinimis(rows, {
    importId: opts.importId,
    makeSourceRef: (row) =>
      `trade.gov:dest=${row.dest}:kind=${row.deMinimisKind}:ef=${row.effectiveFrom
        .toISOString()
        .slice(0, 10)}`,
  });

  return { ok: true as const, inserted: res.inserted, updated: res.updated, count: res.count };
}
