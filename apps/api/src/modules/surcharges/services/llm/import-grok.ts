import {
  surchargeLlmDefaultUserPrompt,
  surchargeLlmSystemPrompt,
} from './prompts/surcharge-llm.js';
import { type LlmSurcharge, LlmSurchargePayload } from './schema.js';

function stripJsonFence(s: string): string {
  const m = s.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  return m ? m[1]! : s;
}

export async function importSurchargesFromGrok(
  effectiveOn?: Date,
  opts: { prompt?: string; model?: string } = {}
): Promise<{ rows: LlmSurcharge[]; usedModel: string }> {
  const ef = (effectiveOn ?? new Date()).toISOString().slice(0, 10);
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY (or GROK_API_KEY) missing');

  const body = {
    model: opts.model || process.env.GROK_MODEL || 'grok-2-latest',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: surchargeLlmSystemPrompt(ef) },
      { role: 'user', content: opts.prompt ?? surchargeLlmDefaultUserPrompt },
    ],
  };

  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Grok surcharges request failed: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const raw = data?.choices?.[0]?.message?.content ?? '{}';
  const content = stripJsonFence(raw);
  const payload = LlmSurchargePayload.parse(JSON.parse(content));

  return { rows: payload.rows, usedModel: data?.model ?? body.model };
}
