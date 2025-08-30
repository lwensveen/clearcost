import OpenAI from 'openai';
import { z } from 'zod';
import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimis } from '../import-de-minimis.js';

const RowSchema = z.object({
  country_code: z.string().length(2), // ISO-3166-1 alpha-2 (e.g. "US")
  kind: z.enum(['DUTY', 'VAT']), // which threshold
  basis: z.enum(['INTRINSIC', 'CIF']).default('INTRINSIC'), // goods-only vs CIF
  currency: z.string().length(3), // ISO-4217 (e.g. "USD")
  value: z.number().nonnegative(), // numeric threshold
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source_url: z.string().url(), // official source
  source_note: z.string().optional(), // short quote/snippet
  confidence: z.number().min(0).max(1).optional(), // model confidence
});
const PayloadSchema = z.object({ rows: z.array(RowSchema).max(2000) });

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function importDeMinimisFromOpenAI(
  effectiveOn?: Date,
  opts: { importId?: string; prompt?: string } = {}
): Promise<{ ok: true; inserted: number; updated: number; count: number; usedModel: string }> {
  const ef = effectiveOn ?? new Date();
  const efStr = isoDay(ef);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');

  const openai = new OpenAI({ apiKey });

  // System prompt: force JSON and sourcing discipline
  const system = `
You are a compliance data agent. Produce de-minimis thresholds for cross-border ecommerce.

RULES:
- Only output JSON that matches the provided schema.
- Prefer primary, official sources (statutes, regulations, customs/tax authority pages, EUR-Lex, GOV.UK, CBSA, CBP).
- Each row MUST include a working "source_url" backing the value claimed.
- Use "basis":"INTRINSIC" unless the official source explicitly indicates CIF/transport-inclusive threshold.
- If a country has no threshold, omit it (do not guess).
- If multiple sources disagree, prefer the most recent official source; otherwise omit.
- The "effective_from" you return should be "${efStr}" unless the official source provides a newer clearly applicable start date (then use that exact date).
- Currencies must be ISO-4217 (e.g., USD, EUR, GBP, CAD).
- Countries must be ISO-2 (e.g., US, GB, CA, DE).
`;

  const user =
    opts.prompt?.trim() && opts.prompt!.trim().length > 0
      ? opts.prompt!
      : `Return as many countries as you can substantiate today. Output only JSON with key "rows".`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // small, cheap, JSON mode capable
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const usedModel = resp.model ?? 'gpt-4o-mini';
  const content = resp.choices[0]?.message?.content ?? '{}';

  let parsed;
  try {
    parsed = PayloadSchema.parse(JSON.parse(content));
  } catch (e) {
    throw new Error(`OpenAI JSON did not match schema: ${(e as Error).message}`);
  }

  // Build a source map so provenance can write the URL into sourceRef.
  const sourceByKey = new Map<string, string>();
  const rows: DeMinimisInsert[] = [];

  for (const r of parsed.rows) {
    const dest = r.country_code.toUpperCase();
    const kind = r.kind;
    const basis = r.basis ?? 'INTRINSIC';
    const currency = r.currency.toUpperCase();
    const value = String(r.value);
    const effectiveFrom = toDate(r.effective_from);
    const effectiveTo = r.effective_to ? toDate(r.effective_to) : null;

    // Keep a map key so makeSourceRef can look it up after upsert
    const key = `${dest}|${kind}|${isoDay(effectiveFrom)}`;
    sourceByKey.set(key, r.source_url);

    rows.push({
      dest,
      deMinimisKind: kind,
      deMinimisBasis: basis,
      currency,
      value,
      effectiveFrom,
      effectiveTo,
    });
  }

  // Ingest with provenance: attach source_url per row via makeSourceRef
  const res = await importDeMinimis(rows, {
    importId: opts.importId,
    makeSourceRef: (row) => {
      const efKey =
        row.effectiveFrom instanceof Date
          ? isoDay(row.effectiveFrom)
          : isoDay(new Date(String(row.effectiveFrom)));
      return sourceByKey.get(`${row.dest}|${row.deMinimisKind}|${efKey}`);
    },
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    usedModel,
  };
}
