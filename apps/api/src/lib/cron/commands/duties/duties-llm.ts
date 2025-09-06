import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { importDutyRatesCrossChecked } from '../../../../modules/duty-rates/services/llm/import-crosscheck.js';
import { importDutyRatesFromGrok } from '../../../../modules/duty-rates/services/llm/import-grok.js';
import { importDutyRatesFromOpenAI } from '../../../../modules/duty-rates/services/llm/import-openai.js';
import { parseDateMaybe } from '../../../parse-date-maybe.js';
import { parseFlags } from '../../utils.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export const dutiesLlmOpenAI: Command = async (args) => {
  const flags = parseFlags(args);
  const prompt = flags.prompt ?? flags.p ?? args.slice(1).join(' ') ?? '';
  const eff = parseDateMaybe(flags.effectiveOn ?? flags.date ?? args[0]) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'OPENAI',
      job: 'duties:llm-openai',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDutyRatesFromOpenAI(effectiveOn, { importId, prompt });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );
  console.log(payload);
};

export const dutiesLlmGrok: Command = async (args) => {
  const flags = parseFlags(args);
  const prompt = flags.prompt ?? flags.p ?? args.slice(1).join(' ') ?? '';
  const eff = parseDateMaybe(flags.effectiveOn ?? flags.date ?? args[0]) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'GROK',
      job: 'duties:llm-grok',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDutyRatesFromGrok(effectiveOn, { importId, prompt });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );
  console.log(payload);
};

export const dutiesLlmCrossCheck: Command = async (args) => {
  const flags = parseFlags(args);
  const mode = (flags.mode ?? 'prefer_official') as 'strict' | 'prefer_official' | 'any';
  const eff = parseDateMaybe(flags.effectiveOn ?? flags.date ?? args[0]) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'LLM_CROSSCHECK',
      job: 'duties:llm-crosscheck',
      params: { mode, effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDutyRatesCrossChecked(effectiveOn, { importId, mode });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, mode, result: res } };
    }
  );
  console.log(payload);
};
