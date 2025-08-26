#!/usr/bin/env bun
/**
 * Cron / one-off importer runner.
 *
 * Usage:
 *   bun run scripts/run-cron.ts fx:refresh
 *   bun run scripts/run-cron.ts import:vat
 *   bun run scripts/run-cron.ts import:duties <json-url>
 *   bun run scripts/run-cron.ts import:surcharges <json-url>
 *   bun run scripts/run-cron.ts import:freight <json-url>
 *   bun run scripts/run-cron.ts import:duties:wits <ISO2,CSV> [--year=2024] [--partners=CA,MX] [--backfill=1] [--concurrency=3] [--batch=5000] [--hs6=010121,020130]
 */

import 'dotenv/config';
import { refreshFx } from './refresh-fx.js';
import { importVatRules } from '../modules/vat/services/import-vat.js';
import { fetchVatRowsFromOfficialSources } from '../modules/vat/services/fetch-vat-official.js';
import { importDutyRates } from '../modules/duty-rates/services/import-duty-rates.js';
import { importSurcharges } from '../modules/surcharges/services/import-surcharges.js';
import { importFreightCards } from '../modules/freight/services/import-cards.js';

const task = process.argv[2];
if (!task) {
  console.error('Usage: bun run scripts/run-cron.ts <task>');
  process.exit(1);
}

const USER_AGENT = 'clearcost-importer';

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Fetch failed ${r.status} ${r.statusText} – ${body}`);
  }
  return (await r.json()) as T;
}

const toNumeric3String = (n: number) => {
  const x = Number(n);
  if (!Number.isFinite(x)) throw new Error(`ratePct not a finite number: ${n}`);
  const s = x.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
};

const toDateOrNull = (v?: string | null) => (v ? new Date(v) : null);
const ensureDate = (v: string, field = 'date') => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${v}`);
  return d;
};

const parseCSV = (s: string | undefined) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function parseFlags(argv: string[]) {
  const flags: Record<string, string> = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (!m) continue;
    const key = m[1];
    const value = m[2] ?? '';
    if (key) flags[key] = value;
  }
  return flags;
}

type DutyRateWire = {
  dest: string;
  hs6: string;
  ratePct: number | string;
  partner?: string | null;
  rule?: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard';
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

type SurchargeWire = {
  dest: string;
  code:
    | 'HMF'
    | 'MPF'
    | 'CUSTOMS_PROCESSING'
    | 'DISBURSEMENT'
    | 'EXCISE'
    | 'HANDLING'
    | 'FUEL'
    | 'SECURITY'
    | 'REMOTE'
    | 'OTHER';
  fixedAmt?: string;
  pctAmt?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

type ImportableDutyRate = Parameters<typeof importDutyRates>[0][number];
type ImportableSurcharge = Parameters<typeof importSurcharges>[0][number];

async function main() {
  switch (task) {
    case 'fx:refresh': {
      const inserted = await refreshFx();
      console.log({ ok: true, inserted });
      break;
    }
    case 'import:vat': {
      const rows = await fetchVatRowsFromOfficialSources();
      console.log(await importVatRules(rows));
      break;
    }
    case 'import:duties': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (duty rates)');

      const wire = await fetchJSON<DutyRateWire[]>(url);

      const normalized: ImportableDutyRate[] = wire.map((r) => ({
        dest: String(r.dest).toUpperCase(),
        partner: r.partner ?? null,
        hs6: String(r.hs6).slice(0, 6),
        ratePct: typeof r.ratePct === 'string' ? r.ratePct : toNumeric3String(r.ratePct),
        rule: r.rule, // must be one of: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard'
        currency: r.currency ?? undefined,
        effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
        effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
        notes: r.notes ?? undefined,
      }));

      console.log(await importDutyRates(normalized));
      break;
    }
    case 'import:duties:wits': {
      // Positional: <ISO2,CSV>
      const list = (process.argv[3] ?? '').trim();
      if (!list) throw new Error('Pass comma-separated ISO2 list, e.g., "US,GB,TH"');

      const dests = parseCSV(list).map((s) => s.toUpperCase());
      const flags = parseFlags(process.argv.slice(4));

      const year = flags.year ? Number(flags.year) : undefined;
      const partners = parseCSV(flags.partners).map((s) => s.toUpperCase());
      const backfillYears = flags.backfill ? Number(flags.backfill) : 1;
      const concurrency = flags.concurrency ? Number(flags.concurrency) : 3;
      const batchSize = flags.batch ? Number(flags.batch) : 5000;
      const hs6List = parseCSV(flags.hs6).map((s) => s.slice(0, 6));

      const { importDutyRatesFromWITS } = await import(
        '../modules/duty-rates/services/wits/import-from-wits.js'
      );

      const res = await importDutyRatesFromWITS({
        dests,
        partners,
        year,
        backfillYears,
        concurrency,
        batchSize,
        hs6List: hs6List.length ? hs6List : undefined,
      });

      console.log(res);
      break;
    }
    case 'import:surcharges': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (surcharges)');

      const wire = await fetchJSON<SurchargeWire[]>(url);

      const mapped: ImportableSurcharge[] = wire.map((r) => ({
        dest: String(r.dest).toUpperCase(),
        code: r.code,
        fixedAmt: r.fixedAmt,
        pctAmt: r.pctAmt,
        effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
        effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
        notes: r.notes ?? undefined,
      }));

      console.log(await importSurcharges(mapped));
      break;
    }
    case 'import:surcharges:us-all': {
      const batchSize = process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : undefined;
      const { importAllUsSurcharges } = await import(
        '../modules/surcharges/services/us/import-all.js'
      );
      console.log(await importAllUsSurcharges({ batchSize }));
      break;
    }
    case 'import:freight': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (freight cards)');
      const rows = await fetchJSON<unknown>(url);
      console.log(await importFreightCards(rows as any));
      break;
    }
    case 'import:surcharges:us-trade-remedies': {
      // flags: --effectiveFrom=YYYY-MM-DD --skipFree=true
      const { importUsTradeRemediesFromHTS } = await import(
        '../modules/surcharges/services/us/import-usitc-hts.js'
      );

      // Reuse your parseFlags helper
      const flags = parseFlags(process.argv.slice(3));
      const effectiveFrom = flags.effectiveFrom
        ? new Date(`${flags.effectiveFrom}T00:00:00Z`)
        : undefined;
      const skipFree =
        typeof flags.skipFree === 'string' && /^(1|true|yes)$/i.test(flags.skipFree.trim());

      const res = await importUsTradeRemediesFromHTS({ effectiveFrom, skipFree });
      console.log(res);
      break;
    }
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
