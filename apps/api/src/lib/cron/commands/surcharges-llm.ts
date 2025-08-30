import { Command, parseFlags, withRun } from '../runtime.js';
import { importSurchargesCrossChecked } from '../../../modules/surcharges/services/llm/import-cross-check.js';
import { importSurchargesFromGrok } from '../../../modules/surcharges/services/llm/import-grok.js';
import { importSurchargesFromLLM } from '../../../modules/surcharges/services/llm/import-llm.js';
import { importSurchargesFromOpenAI } from '../../../modules/surcharges/services/llm/import-openai.js';
import { parseDateMaybe } from '../../parse-date-maybe.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

/**
 * OpenAI → fetch rows → single-writer ingest
 */
export const surchargesLlmOpenAI: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'OPENAI',
      job: 'surcharges:llm-openai',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        model: flags.model,
        prompt: flags.prompt,
      },
    },
    async (importId) => {
      const { rows, usedModel } = await importSurchargesFromOpenAI(effectiveOn, {
        model: flags.model,
        prompt: flags.prompt,
      });

      const res = await importSurchargesFromLLM(rows, {
        importId,
        getSourceRef: (r) => r.source_url,
      });

      return {
        inserted: res.count,
        payload: { importId, usedModel, rows: rows.length, result: res },
      };
    }
  );

  console.log(payload);
};

/**
 * Grok (xAI) → fetch rows → single-writer ingest
 */
export const surchargesLlmGrok: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'GROK',
      job: 'surcharges:llm-grok',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        model: flags.model,
        prompt: flags.prompt,
      },
    },
    async (importId) => {
      const { rows, usedModel } = await importSurchargesFromGrok(effectiveOn, {
        model: flags.model,
        prompt: flags.prompt,
      });

      const res = await importSurchargesFromLLM(rows, {
        importId,
        getSourceRef: (r) => r.source_url,
      });

      return {
        inserted: res.count,
        payload: { importId, usedModel, rows: rows.length, result: res },
      };
    }
  );

  console.log(payload);
};

/**
 * Cross-check (OpenAI + Grok) → reconcile → single-writer ingest
 */
export const surchargesLlmCrossCheck: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const mode = (flags.mode as 'strict' | 'prefer_official' | 'any') ?? 'prefer_official';

  const payload = await withRun(
    {
      importSource: 'LLM_CROSSCHECK',
      job: 'surcharges:llm-crosscheck',
      params: {
        effectiveOn: effectiveOn.toISOString().slice(0, 10),
        mode,
        modelOA: flags.modelOA,
        modelGX: flags.modelGX,
      },
    },
    async (importId) => {
      const res = await importSurchargesCrossChecked(effectiveOn, {
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
