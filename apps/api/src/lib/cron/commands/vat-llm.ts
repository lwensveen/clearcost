import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { parseDateMaybe } from '../../parse-date-maybe.js';
import { importVatFromOpenAI } from '../../../modules/vat/services/llm/import-openai.js';
import { importVatFromGrok } from '../../../modules/vat/services/llm/import-grok.js';
import { importVatFromLLM } from '../../../modules/vat/services/llm/import-llm.js';
import { importVatCrossChecked } from '../../../modules/vat/services/llm/import-cross-check.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

/** OpenAI → fetch rows → single-writer ingest */
export const vatLlmOpenAI: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'OPENAI',
      job: 'vat:llm-openai',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        model: flags.model,
        prompt: flags.prompt,
      },
    },
    async (importId) => {
      const { rows, usedModel } = await importVatFromOpenAI(effectiveOn, {
        model: flags.model,
        prompt: flags.prompt,
      });

      const res = await importVatFromLLM(rows, { importId });

      return {
        inserted: res.count,
        payload: { importId, usedModel, rows: rows.length, result: res },
      };
    }
  );

  console.log(payload);
};

/** Grok (xAI) → fetch rows → single-writer ingest */
export const vatLlmGrok: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'GROK',
      job: 'vat:llm-grok',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        model: flags.model,
        prompt: flags.prompt,
      },
    },
    async (importId) => {
      const { rows, usedModel } = await importVatFromGrok(effectiveOn, {
        model: flags.model,
        prompt: flags.prompt,
      });

      const res = await importVatFromLLM(rows, { importId });

      return {
        inserted: res.count,
        payload: { importId, usedModel, rows: rows.length, result: res },
      };
    }
  );

  console.log(payload);
};

/** Cross-check (OpenAI + Grok) → reconcile → single-writer ingest */
export const vatLlmCrossCheck: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const mode = (flags.mode as 'strict' | 'prefer_official' | 'any') ?? 'prefer_official';

  const payload = await withRun(
    {
      importSource: 'LLM_CROSSCHECK',
      job: 'vat:llm-crosscheck',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        mode,
        modelOA: flags.modelOA,
        modelGX: flags.modelGX,
      },
    },
    async (importId) => {
      const res = await importVatCrossChecked(effectiveOn, {
        importId,
        mode,
        modelOA: flags.modelOA,
        modelGX: flags.modelGX,
        promptOA: flags.promptOA,
        promptGX: flags.promptGX,
      });

      return {
        inserted: res.count,
        payload: { importId, result: res },
      };
    }
  );

  console.log(payload);
};
