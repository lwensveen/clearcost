import { importSurchargesFromOpenAI } from './import-openai.js';
import { importSurchargesFromGrok } from './import-grok.js';
import { importSurchargesFromLLM } from './import-llm.js';
import { LlmSurcharge } from './schema.js';

type Key = string;
const keyOf = (r: LlmSurcharge): Key =>
  `${r.country_code.toUpperCase()}|${(r.origin_code || '').toUpperCase()}|${r.hs6 || ''}|${r.transport_mode}|${r.apply_level}|${r.surcharge_code}|${r.effective_from}`;

const near = (a: number, b: number, tolAbs = 1e-6, tolRel = 0.02) =>
  Math.abs(a - b) <= Math.max(tolAbs, Math.abs(a) * tolRel);

function amountsAgree(a: LlmSurcharge, b: LlmSurcharge) {
  if (a.rate_type !== b.rate_type) return false;
  switch (a.rate_type) {
    case 'ad_valorem':
      if ((a.pct_decimal ?? null) == null || (b.pct_decimal ?? null) == null) return false;
      return near(a.pct_decimal!, b.pct_decimal!, 1e-6, 0.02);
    case 'fixed':
      if ((a.fixed_amount ?? null) == null || (b.fixed_amount ?? null) == null) return false;
      return (
        a.currency?.toUpperCase() === b.currency?.toUpperCase() &&
        near(a.fixed_amount!, b.fixed_amount!, 0.01, 0.02)
      );
    case 'unit':
      if ((a.unit_amount ?? null) == null || (b.unit_amount ?? null) == null) return false;
      return (
        a.currency?.toUpperCase() === b.currency?.toUpperCase() &&
        (a.unit_code || '') === (b.unit_code || '') &&
        near(a.unit_amount!, b.unit_amount!, 0.01, 0.02)
      );
  }
}

const sameMeta = (a: LlmSurcharge, b: LlmSurcharge) =>
  a.country_code.toUpperCase() === b.country_code.toUpperCase() &&
  (a.origin_code || '').toUpperCase() === (b.origin_code || '').toUpperCase() &&
  (a.hs6 || '') === (b.hs6 || '') &&
  a.transport_mode === b.transport_mode &&
  a.apply_level === b.apply_level &&
  a.value_basis === b.value_basis &&
  a.surcharge_code.toUpperCase() === b.surcharge_code.toUpperCase();

const isOfficial = (u?: string | null) => {
  if (!u) return false;
  try {
    const h = new URL(u).hostname.toLowerCase();
    return (
      h.endsWith('.gov') ||
      h.includes('.gov.') ||
      h.endsWith('europa.eu') ||
      h.endsWith('gov.uk') ||
      /(^|.)customs\./.test(h) ||
      /(^|.)tax\./.test(h) ||
      h.endsWith('cbp.gov') ||
      h.endsWith('cbsa-asfc.gc.ca')
    );
  } catch {
    return false;
  }
};

export async function importSurchargesCrossChecked(
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

  const [oa, gx] = await Promise.all([
    importSurchargesFromOpenAI(ef, { prompt: opts.promptOA, model: opts.modelOA }),
    importSurchargesFromGrok(ef, { prompt: opts.promptGX, model: opts.modelGX }),
  ]);

  const mapOA = new Map<Key, LlmSurcharge>();
  const mapGX = new Map<Key, LlmSurcharge>();
  for (const r of oa.rows) mapOA.set(keyOf(r), r);
  for (const r of gx.rows) mapGX.set(keyOf(r), r);

  const decided: LlmSurcharge[] = [];
  const conflicts: Array<{ key: Key; oa?: LlmSurcharge; gx?: LlmSurcharge }> = [];

  const keys = new Set<Key>([...mapOA.keys(), ...mapGX.keys()]);
  for (const k of keys) {
    const a = mapOA.get(k);
    const b = mapGX.get(k);

    if (a && b) {
      if (sameMeta(a, b) && amountsAgree(a, b)) {
        const aOff = isOfficial(a.source_url);
        const bOff = isOfficial(b.source_url);
        decided.push(aOff && !bOff ? a : bOff && !aOff ? b : a);
      } else {
        if (mode === 'any') {
          decided.push(
            isOfficial(a?.source_url) ? (a as LlmSurcharge) : ((b || a) as LlmSurcharge)
          );
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
      if (mode === 'strict') conflicts.push({ key: k, oa: a, gx: b });
      else if (mode === 'prefer_official' && !isOfficial(one.source_url))
        conflicts.push({ key: k, oa: a, gx: b });
      else decided.push(one);
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
      models: { openai: oa.usedModel, grok: gx.usedModel },
    };
  }

  const res = await importSurchargesFromLLM(decided, {
    importId: opts.importId,
    getSourceRef: (row) => row.source_url,
  });

  return {
    ...res, // contains ok/inserted/updated/count
    decided: decided.length,
    conflicts,
    models: { openai: oa.usedModel, grok: gx.usedModel },
  };
}
