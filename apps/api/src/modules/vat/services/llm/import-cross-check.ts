import { importVatFromOpenAI } from './import-openai.js';
import { importVatFromGrok } from './import-grok.js';
import { importVatFromLLM } from './import-llm.js';
import type { LlmVat } from './schema.js';
import { hostHasLabel, hostIsOrSub } from '../../../surcharges/services/llm/import-cross-check.js';

type Key = string;
// Key rows WITHOUT date so OA/Grok can still agree even if dates differ slightly.
const keyOf = (r: LlmVat): Key =>
  `${r.country_code.toUpperCase()}|${String(r.vat_rate_kind).toUpperCase()}`;

const near = (a: number, b: number, tolAbs = 0.2, tolRel = 0.02) =>
  Math.abs(a - b) <= Math.max(tolAbs, Math.abs(a) * tolRel);

const OFFICIAL_PARENTS = [
  'gov', // US government TLD (*.gov)
  'gov.uk', // UK government
  'europa.eu', // EU institutions (covers eur-lex.europa.eu)
] as const;

const isOfficial = (u?: string | null) => {
  if (!u) return false;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

    const host = url.hostname.toLowerCase();

    // Exact or subdomain of known official parents
    for (const parent of OFFICIAL_PARENTS) {
      if (hostIsOrSub(host, parent)) return true;
    }

    // Heuristic: domains under official parents that include “customs” or “tax”
    if (
      (hostHasLabel(host, 'customs') || hostHasLabel(host, 'tax')) &&
      (hostIsOrSub(host, 'gov') || hostIsOrSub(host, 'gov.uk') || hostIsOrSub(host, 'europa.eu'))
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

export async function importVatCrossChecked(
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
    importVatFromOpenAI(ef, { prompt: opts.promptOA, model: opts.modelOA }),
    importVatFromGrok(ef, { prompt: opts.promptGX, model: opts.modelGX }),
  ]);

  const mapOA = new Map<Key, LlmVat>();
  const mapGX = new Map<Key, LlmVat>();
  for (const r of oa.rows) mapOA.set(keyOf(r), r);
  for (const r of gx.rows) mapGX.set(keyOf(r), r);

  const decided: LlmVat[] = [];
  const conflicts: Array<{ key: Key; oa?: LlmVat; gx?: LlmVat }> = [];

  const keys = new Set<Key>([...mapOA.keys(), ...mapGX.keys()]);
  for (const k of keys) {
    const a = mapOA.get(k);
    const b = mapGX.get(k);

    if (a && b) {
      // Agree if rate within tolerance AND base matches (or at least both provided)
      const baseAgree =
        (a.vat_base && b.vat_base && a.vat_base === b.vat_base) || (!a.vat_base && !b.vat_base);
      const rateAgree = near(a.rate_pct, b.rate_pct);
      if (rateAgree && baseAgree) {
        const aOff = isOfficial(a.source_url);
        const bOff = isOfficial(b.source_url);
        decided.push(aOff && !bOff ? a : bOff && !aOff ? b : a);
      } else {
        if (mode === 'any') {
          decided.push(isOfficial(a?.source_url) ? (a as LlmVat) : ((b || a) as LlmVat));
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
      count: 0,
      decided: 0,
      conflicts,
      models: { openai: oa.usedModel, grok: gx.usedModel },
    };
  }

  const res = await importVatFromLLM(decided, { importId: opts.importId });

  return {
    ...res,
    decided: decided.length,
    conflicts,
    models: { openai: oa.usedModel, grok: gx.usedModel },
  };
}
