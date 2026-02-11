import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimis } from '../import-de-minimis.js';
import {
  deMinimisLlmDefaultUserPrompt,
  deMinimisLlmSystemPrompt,
} from './prompts/de-minimis-llm.js';
import type { LlmDeMinimisRow } from './schema.js';
import { PayloadSchema } from './schema.js';
import { httpFetch } from '../../../../lib/http.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function importDeMinimisFromGrok(
  effectiveOn?: Date,
  opts: { importId?: string; prompt?: string; model?: string; ingest?: boolean } = {}
): Promise<{
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  usedModel: string;
  rows: LlmDeMinimisRow[];
}> {
  const ef = effectiveOn ?? new Date();
  const efStr = iso(ef);

  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('Set XAI_API_KEY (or GROK_API_KEY) for Grok');

  // Grok (xAI) is OpenAI-compatible for chat completions at https://api.x.ai/v1/chat/completions
  const body = {
    model: opts.model || process.env.GROK_MODEL || 'grok-2-latest',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: deMinimisLlmSystemPrompt(efStr) },
      {
        role: 'user',
        content: (opts.prompt && opts.prompt.trim()) || deMinimisLlmDefaultUserPrompt,
      },
    ],
  };

  const r = await httpFetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: 30000,
    retries: 2,
    retryOn: (res) => [429, 500, 502, 503, 504].includes(res.status),
  });
  if (!r.ok) throw new Error(`Grok request failed: ${r.status} ${r.statusText}`);
  const json = await r.json();

  const content: string = json?.choices?.[0]?.message?.content ?? '{}';
  const parsed = PayloadSchema.parse(JSON.parse(content));
  const usedModel: string = json?.model || body.model;

  // build source map for provenance
  const sourceByKey = new Map<string, string>();
  const rows: DeMinimisInsert[] = [];

  for (const row of parsed.rows) {
    const dest = row.country_code.toUpperCase();
    const kind = row.kind;
    const basis = row.basis;
    const currency = row.currency.toUpperCase();
    const value = String(row.value);
    const effectiveFrom = toDate(row.effective_from);
    const effectiveTo = row.effective_to ? toDate(row.effective_to) : null;

    const key = `${dest}|${kind}|${iso(effectiveFrom)}`;
    sourceByKey.set(key, row.source_url);

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

  if (opts.ingest === false) {
    return {
      ok: true as const,
      inserted: 0,
      updated: 0,
      count: parsed.rows.length,
      usedModel,
      rows: parsed.rows,
    };
  }

  const res = await importDeMinimis(rows, {
    importId: opts.importId,
    makeSourceRef: (stored) => {
      const efKey =
        stored.effectiveFrom instanceof Date
          ? iso(stored.effectiveFrom)
          : iso(new Date(String(stored.effectiveFrom)));
      return sourceByKey.get(`${stored.dest}|${stored.deMinimisKind}|${efKey}`);
    },
  });

  return {
    ok: true as const,
    inserted: res.inserted,
    updated: res.updated,
    count: res.count,
    usedModel,
    rows: parsed.rows,
  };
}
