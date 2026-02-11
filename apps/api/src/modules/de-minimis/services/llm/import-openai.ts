import OpenAI from 'openai';
import type { DeMinimisInsert } from '@clearcost/types';
import { importDeMinimis } from '../import-de-minimis.js';
import {
  deMinimisLlmDefaultUserPrompt,
  deMinimisLlmSystemPrompt,
} from './prompts/de-minimis-llm.js';
import type { LlmDeMinimisRow } from './schema.js';
import { PayloadSchema } from './schema.js';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function importDeMinimisFromOpenAI(
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
  const efStr = isoDay(ef);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');

  const openai = new OpenAI({ apiKey });

  const system = deMinimisLlmSystemPrompt(efStr);
  const user = (opts.prompt && opts.prompt.trim()) || deMinimisLlmDefaultUserPrompt;

  const resp = await openai.chat.completions.create({
    model: opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const usedModel = resp.model ?? String(opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini');
  const content = resp.choices?.[0]?.message?.content ?? '{}';

  const parsed = PayloadSchema.parse(JSON.parse(content));

  // Build a source map so provenance can write the URL into sourceRef.
  const sourceByKey = new Map<string, string>();
  const rows: DeMinimisInsert[] = [];

  for (const r of parsed.rows) {
    const dest = r.country_code.toUpperCase();
    const kind = r.kind;
    const basis = r.basis;
    const currency = r.currency.toUpperCase();
    const value = String(r.value);
    const effectiveFrom = toDate(r.effective_from);
    const effectiveTo = r.effective_to ? toDate(r.effective_to) : null;

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
    rows: parsed.rows,
  };
}
