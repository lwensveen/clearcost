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
import { importErrors, importRowsInserted, setLastRunNow, startImportTimer } from './metrics.js';
import { batchUpsertSurchargesFromStream } from '../modules/surcharges/utils/batch-upsert.js';
import { finishImportRun, ImportSource, startImportRun } from './provenance.js';

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

function buildImportId(kind: string, parts: Array<string | number | undefined> = []) {
  const stamp = new Date().toISOString(); // stable, sortable
  const suffix = parts.filter(Boolean).join(':');
  return suffix ? `${kind}:${suffix}:${stamp}` : `${kind}:${stamp}`;
}

async function withRun<T>(
  ctx: { source: ImportSource; job: string; params?: any },
  work: (importId: string) => Promise<{ inserted: number; payload: T }>
): Promise<T> {
  const end = startImportTimer({ source: ctx.source, job: ctx.job });
  const run = await startImportRun({ source: ctx.source, job: ctx.job, params: ctx.params });
  try {
    const { inserted, payload } = await work(run.id);
    importRowsInserted.inc({ source: ctx.source, job: ctx.job }, inserted ?? 0);
    setLastRunNow({ source: ctx.source, job: ctx.job });
    end();
    await finishImportRun(run.id, { status: 'succeeded', inserted });
    return payload;
  } catch (err: any) {
    end();
    importErrors.inc({ source: ctx.source, job: ctx.job, stage: 'script' });
    await finishImportRun(run.id, { status: 'failed', error: String(err?.message ?? err) });
    throw err;
  }
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
      const payload = await withRun<{ ok: true; inserted: number }>(
        { source: 'ECB', job: 'fx:daily' },
        async (importId) => {
          const { inserted } = await refreshFx();
          return { inserted, payload: { ok: true, inserted } };
        }
      );
      console.log(payload);
      break;
    }

    case 'import:vat': {
      const payload = await withRun<any>({ source: 'OECD/IMF', job: 'vat:auto' }, async () => {
        const rows = await fetchVatRowsFromOfficialSources();
        const res = await importVatRules(rows);
        const inserted = Number((res as any)?.count ?? rows.length ?? 0);
        return { inserted, payload: res };
      });
      console.log(payload);
      break;
    }

    case 'import:duties': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (duty rates)');

      const payload = await withRun<any>(
        { source: 'file', job: 'duties:json', params: { url } },
        async () => {
          const wire = await fetchJSON<DutyRateWire[]>(url);

          const normalized: ImportableDutyRate[] = wire.map((r) => ({
            dest: String(r.dest).toUpperCase(),
            partner: r.partner ?? null,
            hs6: String(r.hs6).slice(0, 6),
            ratePct: typeof r.ratePct === 'string' ? r.ratePct : toNumeric3String(r.ratePct),
            rule: r.rule,
            currency: r.currency ?? undefined,
            effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
            effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
            notes: r.notes ?? undefined,
          }));

          const res = await importDutyRates(normalized);
          const inserted = Number((res as any)?.count ?? normalized.length ?? 0);
          return { inserted, payload: res };
        }
      );
      console.log(payload);
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

      const importId =
        flags.importId ||
        buildImportId('duties:wits', [
          dests.join('+'),
          partners.length ? `p=${partners.join('+')}` : undefined,
          year ?? new Date().getUTCFullYear() - 1,
        ]);

      const payload = await withRun<any>(
        {
          source: 'WITS',
          job: 'duties:wits',
          params: { dests, partners, year, backfillYears, concurrency, batchSize, hs6List },
        },
        async () => {
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
            importId,
            makeSourceRef: ({ dest, hs6, rule, effectiveFrom }) =>
              `wits:${dest}:${rule}:${hs6}:${String(effectiveFrom).slice(0, 10)}`,
          });

          const inserted = Number((res as any)?.inserted ?? 0);
          return { inserted, payload: res };
        }
      );

      console.log(payload);
      break;
    }

    case 'import:surcharges': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (surcharges)');

      const payload = await withRun<any>(
        { source: 'file', job: 'surcharges:json', params: { url } },
        async (importId) => {
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

          // Use provenance-enabled path
          const res = await batchUpsertSurchargesFromStream(mapped as any, {
            importId,
            makeSourceRef: () => `file:${url}`,
            batchSize: 5000,
          });

          const inserted = Number((res as any)?.inserted ?? (res as any)?.count ?? 0);
          return { inserted, payload: res };
        }
      );

      console.log(payload);
      break;
    }

    case 'import:surcharges:us-all': {
      const payload = await withRun<any>({ source: 'US', job: 'surcharges:us-all' }, async () => {
        const batchSize = process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : undefined;
        const { importAllUsSurcharges } = await import(
          '../modules/surcharges/services/us/import-all.js'
        );
        const res = await importAllUsSurcharges({ batchSize });
        const inserted = Number((res as any)?.inserted ?? (res as any)?.count ?? 0);
        return { inserted, payload: res };
      });
      console.log(payload);
      break;
    }

    case 'import:freight': {
      const url = process.argv[3];
      if (!url) throw new Error('Pass URL to JSON (freight cards)');

      const payload = await withRun<any>(
        { source: 'file', job: 'freight:json', params: { url } },
        async () => {
          const rows = await fetchJSON<unknown>(url);
          const res = await importFreightCards(rows as any);
          const inserted = Number((res as any)?.count ?? 0);
          return { inserted, payload: res };
        }
      );
      console.log(payload);
      break;
    }

    case 'import:surcharges:us-trade-remedies': {
      // flags: --effectiveFrom=YYYY-MM-DD --skipFree=true
      const flags = parseFlags(process.argv.slice(3));
      const effectiveFrom = flags.effectiveFrom
        ? new Date(`${flags.effectiveFrom}T00:00:00Z`)
        : undefined;
      const skipFree =
        typeof flags.skipFree === 'string' && /^(1|true|yes)$/i.test(flags.skipFree.trim());

      const payload = await withRun<any>(
        {
          source: 'USITC_HTS',
          job: 'surcharges:us-trade-remedies',
          params: { effectiveFrom, skipFree },
        },
        async () => {
          const { importUsTradeRemediesFromHTS } = await import(
            '../modules/surcharges/services/us/import-usitc-hts.js'
          );
          const res = await importUsTradeRemediesFromHTS({ effectiveFrom, skipFree });
          const inserted = Number((res as any)?.count ?? 0);
          return { inserted, payload: res };
        }
      );
      console.log(payload);
      break;
    }

    case 'import:hs6': {
      const year = process.argv[3] ? Number(process.argv[3]) : undefined;
      const payload = await withRun<any>(
        { source: 'WITS', job: 'hs:hs6', params: { year } },
        async () => {
          const { importHs6FromWits } = await import(
            '../modules/hs-codes/services/import-hs6-from-wits.js'
          );
          const res = await importHs6FromWits(year);
          const inserted = Number((res as any)?.count ?? 0);
          return { inserted, payload: res };
        }
      );
      console.log(payload);
      break;
    }

    case 'import:hs:us-hts10': {
      const payload = await withRun<any>({ source: 'USITC_HTS', job: 'hs:us-hts10' }, async () => {
        const { importUsHts10Aliases } = await import(
          '../modules/hs-codes/services/aliases/import-hts10.js'
        );
        const res = await importUsHts10Aliases();
        const inserted = Number((res as any)?.count ?? 0);
        return { inserted, payload: res };
      });
      console.log(payload);
      break;
    }

    case 'import:hs:uk10': {
      const payload = await withRun<any>({ source: 'UK_TT', job: 'hs:uk10' }, async () => {
        const { importUk10Aliases } = await import(
          '../modules/hs-codes/services/aliases/import-uk10.js'
        );
        const res = await importUk10Aliases();
        const inserted = Number((res as any)?.count ?? 0);
        return { inserted, payload: res };
      });
      console.log(payload);
      break;
    }

    case 'import:duties:wits:asean': {
      const dests = ['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'BN', 'KH', 'LA', 'MM'];
      const partners = dests;

      const importId = buildImportId('duties:wits:asean', [
        `d=${dests.join('+')}`,
        `p=${partners.join('+')}`,
        new Date().getUTCFullYear() - 1,
      ]);

      const payload = await withRun<any>(
        { source: 'WITS', job: 'duties:wits:asean', params: { dests, partners } },
        async () => {
          const { importDutyRatesFromWITS } = await import(
            '../modules/duty-rates/services/wits/import-from-wits.js'
          );
          const res = await importDutyRatesFromWITS({
            dests,
            partners,
            backfillYears: 1,
            concurrency: 4,
            batchSize: 5000,
            importId,
            makeSourceRef: ({ dest, hs6, rule, effectiveFrom }) =>
              `wits:${dest}:${rule}:${hs6}:${String(effectiveFrom).slice(0, 10)}`,
          });
          const inserted = Number((res as any)?.inserted ?? 0);
          return { inserted, payload: res };
        }
      );

      console.log(payload);
      break;
    }

    case 'import:duties:wits:japan': {
      const dests = ['JP'];
      const partners = [
        'CN',
        'KR',
        'AU',
        'NZ',
        'TH',
        'MY',
        'ID',
        'PH',
        'VN',
        'LA',
        'KH',
        'BN',
        'SG',
        'CA',
        'MX',
        'EU',
        'GB',
        'US',
      ];

      const importId = buildImportId('duties:wits:japan', [
        `d=${dests.join('+')}`,
        `p=${partners.join('+')}`,
        new Date().getUTCFullYear() - 1,
      ]);

      const payload = await withRun<any>(
        { source: 'WITS', job: 'duties:wits:japan', params: { dests, partners } },
        async () => {
          const { importDutyRatesFromWITS } = await import(
            '../modules/duty-rates/services/wits/import-from-wits.js'
          );
          const res = await importDutyRatesFromWITS({
            dests,
            partners,
            backfillYears: 1,
            concurrency: 3,
            batchSize: 5000,
            importId,
            makeSourceRef: ({ dest, hs6, rule, effectiveFrom }) =>
              `wits:${dest}:${rule}:${hs6}:${String(effectiveFrom).slice(0, 10)}`,
          });
          const inserted = Number((res as any)?.inserted ?? 0);
          return { inserted, payload: res };
        }
      );

      console.log(payload);
      break;
    }

    case 'import:hs:ahtn': {
      const url = process.argv[3];
      const payload = await withRun<any>(
        { source: 'AHTN', job: 'hs:ahtn', params: { url } },
        async () => {
          const { importAhtnAliases } = await import(
            '../modules/hs-codes/services/aliases/import-ahtn.js'
          );
          const res = await importAhtnAliases({ url });
          const inserted = Number((res as any)?.count ?? 0);
          return { inserted, payload: res };
        }
      );
      console.log(payload);
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
