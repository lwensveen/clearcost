import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { importDeMinimisCrossChecked } from '../../../modules/de-minimis/services/llm/import-crosscheck.js';
import { importDeMinimisFromGrok } from '../../../modules/de-minimis/services/llm/import-grok.js';
import { importDeMinimisFromOfficial } from '../../../modules/de-minimis/services/import-official.js';
import { importDeMinimisFromOpenAI } from '../../../modules/de-minimis/services/llm/import-openai.js';
import { importDeMinimisFromTradeGov } from '../../../modules/de-minimis/services/import-trade-gov.js';
import { importDeMinimisFromZonos } from '../../../modules/de-minimis/services/import-from-zonos.js';
import { parseDateMaybe } from '../../parse-date-maybe.js';
import { seedDeMinimisBaseline } from '../../../modules/de-minimis/services/import-baseline.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export const deMinimisZonos: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'ZONOS',
      job: 'de-minimis:import-zonos',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDeMinimisFromZonos(effectiveOn, { importId });
      const inserted = res.count ?? (res.inserted ?? 0) + (res.updated ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'de-minimis:official',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDeMinimisFromOfficial(effectiveOn, { importId });
      const inserted = res.inserted ?? 0;
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisSeedBaseline: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'BASELINE',
      job: 'de-minimis:seed',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await seedDeMinimisBaseline(effectiveOn, { importId });
      const inserted = res.inserted ?? 0;
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisTradeGov: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'TRADE_GOV',
      job: 'de-minimis:trade-gov',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async (importId) => {
      const res = await importDeMinimisFromTradeGov(effectiveOn, { importId });
      const inserted = res.count ?? (res.inserted ?? 0) + (res.updated ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisOpenAI: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const prompt = flags.prompt ?? flags.p ?? args.slice(1).join(' ') ?? '';
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = new Date(eff.toISOString().slice(0, 10));

  const payload = await withRun(
    {
      importSource: 'OPENAI',
      job: 'de-minimis:openai',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10), prompt },
    },
    async (importId) => {
      const res = await importDeMinimisFromOpenAI(effectiveOn, { importId, prompt });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisGrok: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const prompt = flags.prompt ?? flags.p ?? args.slice(1).join(' ') ?? '';
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = new Date(eff.toISOString().slice(0, 10));

  const payload = await withRun(
    {
      importSource: 'GROK',
      job: 'de-minimis:grok',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10), prompt },
    },
    async (importId) => {
      const res = await importDeMinimisFromGrok(effectiveOn, { importId, prompt });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, result: res } };
    }
  );

  console.log(payload);
};

export const deMinimisCrossCheck: Command = async (args) => {
  const flags = parseFlags(args);
  const effRaw = args[0] ?? flags.effectiveOn ?? flags.date;
  const mode = (flags.mode ?? 'prefer_official') as 'strict' | 'prefer_official' | 'any';
  const eff = parseDateMaybe(effRaw) ?? new Date();
  const effectiveOn = new Date(eff.toISOString().slice(0, 10));

  const payload = await withRun(
    {
      importSource: 'LLM_CROSSCHECK',
      job: 'de-minimis:crosscheck',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10), mode },
    },
    async (importId) => {
      const res = await importDeMinimisCrossChecked(effectiveOn, { importId, mode });
      const inserted = Number(res.count ?? res.inserted ?? 0);
      return { inserted, payload: { importId, effectiveOn, mode, result: res } };
    }
  );

  console.log(payload);
};
