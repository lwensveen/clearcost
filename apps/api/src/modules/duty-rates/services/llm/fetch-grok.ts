import { z } from 'zod';
import { dutyLlmDefaultUserPrompt, dutyLlmSystemPrompt } from './prompts/duty-llm.js';

const DutyRuleSchema = z.enum(['mfn', 'fta', 'anti_dumping', 'safeguard']);

const LlmComponent = z.object({
  type: z.enum(['advalorem', 'specific', 'minimum', 'maximum', 'other']),
  rate_pct: z.number().optional().nullable(),
  amount: z.number().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  uom: z.string().max(32).optional().nullable(),
  qualifier: z.string().max(32).optional().nullable(),
});

const LlmDutyRowSchema = z.object({
  country_code: z.string().length(2),
  partner: z.string().max(2).optional().default(''),
  hs6: z.string().regex(/^\d{6}$/),
  duty_rule: DutyRuleSchema.default('mfn'),
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

const LlmPayload = z.object({ rows: z.array(LlmDutyRowSchema).max(5000) });

export type LlmDutyRow = z.infer<typeof LlmDutyRowSchema>;

export async function fetchDutyRatesFromGrok(
  effectiveOn?: Date,
  opts: { importId?: string; prompt?: string; model?: string } = {}
): Promise<{ ok: true; usedModel: string; rows: LlmDutyRow[] }> {
  const ef = (effectiveOn ?? new Date()).toISOString().slice(0, 10);
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY (or GROK_API_KEY) missing');

  const body = {
    model: opts.model || process.env.GROK_MODEL || 'grok-2-latest',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: dutyLlmSystemPrompt(ef) },
      { role: 'user', content: opts.prompt ?? dutyLlmDefaultUserPrompt },
    ],
  };

  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Grok duties request failed: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '{}';
  const parsed = LlmPayload.parse(JSON.parse(content));

  // Fetch-only: return rows without ingesting
  return {
    ok: true as const,
    usedModel: data?.model ?? body.model,
    rows: parsed.rows as LlmDutyRow[],
  };
}
