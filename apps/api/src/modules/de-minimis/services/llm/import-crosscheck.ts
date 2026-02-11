import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimisFromOpenAI } from './import-openai.js';
import { importDeMinimisFromGrok } from './import-grok.js';
import { importDeMinimis } from '../import-de-minimis.js';
import { hostIsOrSub } from '../../../surcharges/services/llm/import-cross-check.js';

type RowLLM = {
  country_code: string;
  kind: 'DUTY' | 'VAT';
  basis: 'INTRINSIC' | 'CIF';
  currency: string;
  value: number;
  effective_from: string;
  effective_to?: string | null;
  source_url: string;
  confidence?: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export function lastLabel(host: string): string {
  const parts = host.toLowerCase().replace(/\.+$/, '').split('.');
  return parts[parts.length - 1] || '';
}

function isOfficial(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/\.+$/, '');

    if (lastLabel(h) === 'gov') return true;

    const bases = [
      'gov.uk',
      'europa.eu',
      'eur-lex.europa.eu',
      'cbp.gov',
      'cbsa-asfc.gc.ca',
      'gc.ca',
    ];
    for (const base of bases) {
      if (hostIsOrSub(h, base)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function keyOf(r: Pick<RowLLM, 'country_code' | 'kind'>) {
  return `${r.country_code.toUpperCase()}|${r.kind}`;
}

function agree(a: RowLLM, b: RowLLM) {
  if (a.currency.toUpperCase() !== b.currency.toUpperCase()) return false;
  if (a.basis !== b.basis) return false;
  const va = a.value,
    vb = b.value;
  const tolAbs = Math.max(1, Math.min(5, va * 0.01)); // 1% cap 5 units
  return Math.abs(va - vb) <= tolAbs;
}

export async function importDeMinimisCrossChecked(
  effectiveOn?: Date,
  opts: { importId?: string; mode?: 'strict' | 'prefer_official' | 'any' } = {}
) {
  const ef = effectiveOn ?? new Date();

  // 1) call both
  const [oa, gx] = await Promise.all([
    importDeMinimisFromOpenAI(ef, {
      prompt: 'Return maximum coverage with official sources only. JSON only.',
      ingest: false,
    }),
    importDeMinimisFromGrok(ef, {
      prompt: 'Return maximum coverage with official sources only. JSON only.',
      ingest: false,
    }),
  ]);

  // 2) build maps
  const mapOA = new Map<string, RowLLM>();
  const mapGX = new Map<string, RowLLM>();

  const rowsOA: RowLLM[] = oa.rows;
  const rowsGX: RowLLM[] = gx.rows;

  for (const r of rowsOA) mapOA.set(keyOf(r), r);
  for (const r of rowsGX) mapGX.set(keyOf(r), r);

  // 3) reconcile
  const decided: Array<{ primary: RowLLM; secondary?: RowLLM }> = [];
  const conflicts: Array<{ key: string; oa?: RowLLM; gx?: RowLLM }> = [];

  const keys = new Set<string>([...mapOA.keys(), ...mapGX.keys()]);

  for (const k of keys) {
    const a = mapOA.get(k);
    const b = mapGX.get(k);
    if (a && b) {
      if (agree(a, b)) {
        // accept – prefer official source among them
        const aOff = isOfficial(a.source_url),
          bOff = isOfficial(b.source_url);
        decided.push({
          primary: aOff && !bOff ? a : bOff && !aOff ? b : a,
          secondary: a === b ? undefined : aOff ? b : a,
        });
      } else {
        // prefer official if one is official
        const aOff = a && isOfficial(a.source_url);
        const bOff = b && isOfficial(b.source_url);
        if (opts.mode !== 'strict' && (aOff || bOff)) {
          decided.push({ primary: aOff ? a! : b!, secondary: aOff ? b! : a! });
        } else {
          conflicts.push({ key: k, oa: a, gx: b });
        }
      }
    } else {
      const one = a ?? b!;
      const off = isOfficial(one.source_url);
      if (opts.mode === 'strict') {
        conflicts.push({ key: k, oa: a, gx: b });
      } else if (opts.mode === 'prefer_official' && !off) {
        conflicts.push({ key: k, oa: a, gx: b });
      } else {
        decided.push({ primary: one });
      }
    }
  }

  // 4) build final inserts (value must be string for your types)
  const sourceRef = new Map<string, string>(); // key -> combined source
  const rows: DeMinimisInsert[] = [];
  for (const d of decided) {
    const r = d.primary;
    const key = keyOf(r);
    const currency = r.currency.toUpperCase();
    rows.push({
      dest: r.country_code.toUpperCase(),
      deMinimisKind: r.kind,
      deMinimisBasis: r.basis,
      currency,
      value: String(r.value),
      effectiveFrom: toDate(r.effective_from || iso(ef)),
      effectiveTo: r.effective_to ? toDate(r.effective_to) : null,
    });
    const src = d.secondary
      ? `${r.source_url} || secondary:${d.secondary.source_url}`
      : r.source_url;
    sourceRef.set(key, src);
  }

  // 5) ingest with provenance (primary + secondary packed in sourceRef)
  const res = await importDeMinimis(rows, {
    importId: opts.importId,
    makeSourceRef: (row) => sourceRef.get(`${row.dest}|${row.deMinimisKind}`),
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    decided: decided.length,
    conflicts,
    models: { openai: oa.usedModel ?? 'openai', grok: gx.usedModel ?? 'grok' },
  };
}
