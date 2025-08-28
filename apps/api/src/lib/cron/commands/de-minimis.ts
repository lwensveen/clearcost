import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { importDeMinimisFromZonos } from '../../../modules/de-minimis/services/import-from-zonos.js';
import { importDeMinimisFromOfficial } from '../../../modules/de-minimis/services/import-official.js';
import { seedDeMinimisBaseline } from '../../../modules/de-minimis/services/import-baseline.js';

const toMidnightUTC = (d: Date) => new Date(d.toISOString().slice(0, 10));

export const deMinimisZonos: Command = async (args) => {
  const flags = parseFlags(args);
  const effArg = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = effArg ? new Date(effArg) : new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'ZONOS',
      job: 'de-minimis:import-zonos',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async () => {
      const res = await importDeMinimisFromZonos(effectiveOn);
      const inserted = Number((res as any).insertedOrUpdated ?? (res as any).inserted ?? 0);
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};

export const deMinimisOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const effArg = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = effArg ? new Date(effArg) : new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'de-minimis:official',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async () => {
      const res = await importDeMinimisFromOfficial(effectiveOn);
      const inserted = Number((res as any).inserted ?? (res as any).count ?? 0);
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};

export const deMinimisSeedBaseline: Command = async (args) => {
  const flags = parseFlags(args);
  const effArg = args[0] ?? flags.effectiveOn ?? flags.date;
  const eff = effArg ? new Date(effArg) : new Date();
  const effectiveOn = toMidnightUTC(eff);

  const payload = await withRun(
    {
      importSource: 'BASELINE',
      job: 'de-minimis:seed',
      params: { effectiveOn: effectiveOn.toISOString().slice(0, 10) },
    },
    async () => {
      const res = await seedDeMinimisBaseline(effectiveOn);
      const inserted = Number((res as any).inserted ?? 0);
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
