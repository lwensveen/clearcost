import { z } from 'zod';
import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimis } from '../import-de-minimis.js';
import {
  deMinimisLlmDefaultUserPrompt,
  deMinimisLlmSystemPrompt,
} from './prompts/de-minimis-llm.js';
import { PayloadSchema, RowSchema } from './schema.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function importDeMinimisFromGrok(
  effectiveOn?: Date,
  opts: { importId?: string; prompt?: string; model?: string } = {}
): Promise<{
  ok: true;
  inserted: number;
  updated: number;
  count: number;
  usedModel: string;
  rows: z.infer<typeof RowSchema>[];
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

  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
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
    const basis = row.basis ?? 'INTRINSIC';
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
