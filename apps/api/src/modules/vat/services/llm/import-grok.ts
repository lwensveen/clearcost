import { LlmVat, LlmVatPayload } from './schema.js';
import { vatLlmDefaultUserPrompt, vatLlmSystemPrompt } from './prompts/vat-llm.js';
import { httpFetch } from '../../../../lib/http.js';

export async function importVatFromGrok(
  effectiveOn?: Date,
  opts: { prompt?: string; model?: string } = {}
): Promise<{ rows: LlmVat[]; usedModel: string }> {
  const ef = (effectiveOn ?? new Date()).toISOString().slice(0, 10);
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY (or GROK_API_KEY) missing');

  const body = {
    model: opts.model || process.env.GROK_MODEL || 'grok-2-latest',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: vatLlmSystemPrompt(ef) },
      { role: 'user', content: opts.prompt ?? vatLlmDefaultUserPrompt },
    ],
  };

  const r = await httpFetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 30000,
    retries: 2,
    retryOn: (res) => [429, 500, 502, 503, 504].includes(res.status),
  });
  if (!r.ok) throw new Error(`Grok VAT request failed: ${r.status} ${r.statusText}`);

  const data = await r.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '{}';
  const payload = LlmVatPayload.parse(JSON.parse(content));
  return { rows: payload.rows, usedModel: data?.model ?? body.model };
}
