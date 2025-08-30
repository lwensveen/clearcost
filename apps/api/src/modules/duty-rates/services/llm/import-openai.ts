import { z } from 'zod';
import type { dutyRatesTable } from '@clearcost/db';
import { batchUpsertDutyRatesFromStream } from '../../utils/batch-upsert.js';
import { upsertDutyRateComponentsForLLM } from './upsert-duty-components.js';
import { dutyLlmDefaultUserPrompt, dutyLlmSystemPrompt } from './prompts/duty-llm.js';

const LlmComponent = z.object({
  type: z.enum(['advalorem', 'specific', 'minimum', 'maximum', 'other']),
  rate_pct: z.number().optional().nullable(),
  amount: z.number().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  uom: z.string().max(32).optional().nullable(),
  qualifier: z.string().max(32).optional().nullable(),
});

const LlmDutyRow = z.object({
  country_code: z.string().length(2),
  partner: z.string().max(2).optional().default(''),
  hs6: z.string().regex(/^\d{6}$/),
  duty_rule: z.enum(['mfn', 'fta', 'anti_dumping', 'safeguard']).default('mfn'),
  currency: z.string().length(3).optional(),
  components: z.array(LlmComponent).min(1),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  source_url: z.string().url(),
});

const LlmPayload = z.object({ rows: z.array(LlmDutyRow).max(5000) });

type DutyInsert = typeof dutyRatesTable.$inferInsert;

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const up = (s?: string | null) => (s ? s.trim().toUpperCase() : undefined);

function pickHeadlinePct(components: z.infer<typeof LlmComponent>[]) {
  const v = components.find((c) => c.type === 'advalorem' && c.rate_pct != null)?.rate_pct;
  return typeof v === 'number' && Number.isFinite(v)
    ? (Math.round(v * 1000) / 1000).toFixed(3) // NUMERIC(6,3) percent, e.g. "16.500"
    : '0.000';
}

/**
 * Import duty rates via OpenAI JSON output and upsert.
 * - Stores headline ad valorem % in duty_rates.rate_pct (0.000 if none)
 * - Uses source='llm' so OFFICIAL can overwrite later
 */
export async function importDutyRatesFromOpenAI(
  effectiveOn?: Date,
  opts: { importId?: string; prompt?: string; model?: string } = {}
) {
  const ef = (effectiveOn ?? new Date()).toISOString().slice(0, 10);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const body = {
    model: opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: dutyLlmSystemPrompt(ef) },
      { role: 'user', content: opts.prompt ?? dutyLlmDefaultUserPrompt },
    ],
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI duties request failed: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '{}';
  const payload = LlmPayload.parse(JSON.parse(content));

  const rows: DutyInsert[] = payload.rows.map((row) => ({
    dest: row.country_code.toUpperCase(),
    partner: (row.partner || '').toUpperCase(),
    hs6: row.hs6,
    dutyRule: row.duty_rule, // already validated enum
    ratePct: pickHeadlinePct(row.components),
    currency: up(row.currency),
    effectiveFrom: toDate(row.effective_from),
    effectiveTo: row.effective_to ? toDate(row.effective_to) : null,
    notes: null,
  }));

  const sourceByKey = new Map<string, string>();
  for (const r of payload.rows) {
    sourceByKey.set(
      `${r.country_code.toUpperCase()}|${(r.partner || '').toUpperCase()}|${r.hs6}|${r.duty_rule}|${r.effective_from}`,
      r.source_url
    );
  }

  const res = await batchUpsertDutyRatesFromStream(rows, {
    source: 'llm',
    importId: opts.importId,
    makeSourceRef: (row) =>
      sourceByKey.get(
        `${row.dest}|${row.partner || ''}|${row.hs6}|${String(
          row.dutyRule
        )}|${(row.effectiveFrom as Date).toISOString().slice(0, 10)}`
      ) || undefined,
  });

  await upsertDutyRateComponentsForLLM(payload.rows, { importId: opts.importId });

  return { usedModel: data?.model ?? body.model, ...res };
}
