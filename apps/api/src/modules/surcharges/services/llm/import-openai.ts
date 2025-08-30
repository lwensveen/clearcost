import { type LlmSurcharge, LlmSurchargePayload } from './schema.js';
import {
  surchargeLlmDefaultUserPrompt,
  surchargeLlmSystemPrompt,
} from './prompts/surcharge-llm.js';

export async function importSurchargesFromOpenAI(
  effectiveOn?: Date,
  opts: { prompt?: string; model?: string } = {}
): Promise<{ rows: LlmSurcharge[]; usedModel: string }> {
  const ef = (effectiveOn ?? new Date()).toISOString().slice(0, 10);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const body = {
    model: opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: surchargeLlmSystemPrompt(ef) },
      { role: 'user', content: opts.prompt ?? surchargeLlmDefaultUserPrompt },
    ],
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI surcharges request failed: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '{}';
  const payload = LlmSurchargePayload.parse(JSON.parse(content));
  return { rows: payload.rows, usedModel: data?.model ?? body.model };
}
