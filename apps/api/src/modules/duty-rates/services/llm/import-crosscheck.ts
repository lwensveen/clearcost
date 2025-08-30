import { fetchDutyRatesFromGrok, LlmDutyRow } from './fetch-grok.js';
import { fetchDutyRatesFromOpenAI } from './fetch-openai.js';
import { importDutyRatesFromLLM } from './import-llm-ingest.js';

const iso = (d: Date | string) => {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

type Key = string;
const keyOf = (r: LlmDutyRow): Key =>
  `${r.country_code.toUpperCase()}|${(r.partner || '').toUpperCase()}|${r.hs6}|${String(
    r.duty_rule
  ).toLowerCase()}`;

// Very conservative “official” heuristic
function isOfficial(u?: string | null) {
  if (!u) return false;
  try {
    const h = new URL(u).hostname.toLowerCase();
    return (
      h.endsWith('.gov') ||
      h.includes('.gov.') ||
      h.endsWith('europa.eu') ||
      h.endsWith('eur-lex.europa.eu') ||
      h.endsWith('gov.uk') ||
      h.endsWith('cbp.gov') ||
      h.endsWith('cbsa-asfc.gc.ca') ||
      h.endsWith('gc.ca') || // Canada federal domains
      /(^|.)customs\./.test(h) ||
      /(^|.)tax\./.test(h)
    );
  } catch {
    return false;
  }
}

function adval(r: LlmDutyRow): number | null {
  const c = r.components.find((x) => x.type === 'advalorem' && x.rate_pct != null);
  return typeof c?.rate_pct === 'number' ? c.rate_pct : null;
}

function specificsComparable(a: LlmDutyRow, b: LlmDutyRow): boolean {
  const As = a.components.filter((c) => c.type !== 'advalorem');
  const Bs = b.components.filter((c) => c.type !== 'advalorem');
  if (As.length !== Bs.length) return false;

  const sig = (c: any) =>
    `${c.type}|${(c.currency || '').toUpperCase()}|${c.uom || ''}|${c.qualifier || ''}`;

  const mapA = new Map<string, number>(
    As.map((c) => [sig(c), typeof c.amount === 'number' ? c.amount : NaN])
  );

  for (const c of Bs) {
    const k = sig(c);
    if (!mapA.has(k)) return false;
    const aAmt = mapA.get(k)!;
    const bAmt = typeof c.amount === 'number' ? c.amount : NaN;
    if (!Number.isFinite(aAmt) || !Number.isFinite(bAmt)) return false;
    const tol = Math.max(0.01, aAmt * 0.01); // 1% or 0.01
    if (Math.abs(aAmt - bAmt) > tol) return false;
  }
  return true;
}

function agree(a: LlmDutyRow, b: LlmDutyRow): boolean {
  const avA = adval(a);
  const avB = adval(b);
  if (avA != null || avB != null) {
    if (avA == null || avB == null) return false;
    const tol = Math.max(0.2, avA * 0.02); // 0.2 percentage points or 2% relative
    if (Math.abs(avA - avB) > tol) return false;
  }
  return specificsComparable(a, b);
}

export async function importDutyRatesCrossChecked(
  effectiveOn?: Date,
  opts: {
    importId?: string;
    mode?: 'strict' | 'prefer_official' | 'any';
    promptOA?: string;
    promptGX?: string;
    modelOA?: string;
    modelGX?: string;
  } = {}
) {
  const ef = effectiveOn ?? new Date();
  const mode = opts.mode ?? 'prefer_official';

  // 1) fetch both (fetch-only functions)
  const [oa, gx] = await Promise.all([
    fetchDutyRatesFromOpenAI(ef, { prompt: opts.promptOA, model: opts.modelOA }),
    fetchDutyRatesFromGrok(ef, { prompt: opts.promptGX, model: opts.modelGX }),
  ]);

  const oaRows = oa.rows;
  const gxRows = gx.rows;

  const mapOA = new Map<Key, LlmDutyRow>();
  const mapGX = new Map<Key, LlmDutyRow>();
  for (const r of oaRows) mapOA.set(keyOf(r), r);
  for (const r of gxRows) mapGX.set(keyOf(r), r);

  const decided: LlmDutyRow[] = [];
  const conflicts: Array<{ key: Key; oa?: LlmDutyRow; gx?: LlmDutyRow }> = [];

  const keys = new Set<Key>([...mapOA.keys(), ...mapGX.keys()]);
  for (const k of keys) {
    const a = mapOA.get(k);
    const b = mapGX.get(k);

    if (a && b) {
      if (agree(a, b)) {
        const aOff = isOfficial(a.source_url);
        const bOff = isOfficial(b.source_url);
        decided.push(aOff && !bOff ? a : bOff && !aOff ? b : a);
      } else {
        if (mode === 'any') {
          decided.push(isOfficial(a?.source_url) ? (a as LlmDutyRow) : ((b || a) as LlmDutyRow));
        } else if (mode === 'prefer_official') {
          if (a && isOfficial(a.source_url)) decided.push(a);
          else if (b && isOfficial(b.source_url)) decided.push(b);
          else conflicts.push({ key: k, oa: a, gx: b });
        } else {
          conflicts.push({ key: k, oa: a, gx: b });
        }
      }
    } else {
      const one = (a ?? b)!;
      if (mode === 'strict') {
        conflicts.push({ key: k, oa: a, gx: b });
      } else if (mode === 'prefer_official' && !isOfficial(one.source_url)) {
        conflicts.push({ key: k, oa: a, gx: b });
      } else {
        decided.push(one);
      }
    }
  }

  if (decided.length === 0) {
    return {
      ok: true as const,
      inserted: 0,
      updated: 0,
      count: 0,
      decided: 0,
      conflicts,
      models: {
        openai: oa.usedModel,
        grok: gx.usedModel,
      },
    };
  }

  // 2) provenance map for ingestion
  const srcByKey = new Map<string, string | undefined>();
  for (const r of decided) {
    srcByKey.set(
      `${r.country_code.toUpperCase()}|${(r.partner || '').toUpperCase()}|${r.hs6}|${String(
        r.duty_rule
      ).toLowerCase()}|${r.effective_from}`,
      r.source_url
    );
  }

  // 3) ingest reconciled rows (single writer)
  const res = await importDutyRatesFromLLM(decided, {
    importId: opts.importId,
    makeSourceRef: (p) =>
      srcByKey.get(
        `${p.dest}|${p.partner || ''}|${p.hs6}|${String(p.dutyRule)}|${iso(p.effectiveFrom)}`
      ),
  });

  return {
    ...res,
    decided: decided.length,
    conflicts,
    models: {
      openai: oa.usedModel,
      grok: gx.usedModel,
    },
  };
}
