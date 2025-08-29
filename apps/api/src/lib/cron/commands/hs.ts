import type { Command } from '../runtime.js';
import { parseFlags, withRun } from '../runtime.js';
import { importEuHs6FromTaric } from '../../../modules/hs-codes/services/aliases/eu/import-cn6-from-taric.js';
import { importHs6FromWits } from '../../../modules/hs-codes/services/import-hs6-from-wits.js';
import { importUsHts10Aliases } from '../../../modules/hs-codes/services/aliases/us/import-hts10.js';
import { importUk10Aliases } from '../../../modules/hs-codes/services/aliases/uk/import-uk10.js';
import { importAhtnAliases } from '../../../modules/hs-codes/services/aliases/asean/import-ahtn.js';
import { importEuAliasesFromTaric } from '../../../modules/hs-codes/services/aliases/eu/import-aliases-from-taric.js';

export const hsImportHs6: Command = async (args) => {
  const year = args?.[0] && !Number.isNaN(Number(args[0])) ? Number(args[0]) : undefined;

  const payload = await withRun(
    { importSource: 'WITS', job: 'hs:hs6', params: { year } },
    async () => {
      const res = await importHs6FromWits(year);
      return {
        inserted: res.inserted,
        updated: res.updated,
        count: res.count,
        payload: res,
      };
    }
  );

  console.log(payload);
};

export const hsUsHts10: Command = async () => {
  const payload = await withRun({ importSource: 'USITC_HTS', job: 'hs:us-hts10' }, async () => {
    const res = await importUsHts10Aliases();
    return {
      inserted: res.inserted,
      updated: res.updated,
      count: res.count,
      payload: res,
    };
  });
  console.log(payload);
};

export const hsUk10: Command = async () => {
  const payload = await withRun({ importSource: 'UK_TT', job: 'hs:uk10' }, async () => {
    const res = await importUk10Aliases();
    const inserted = res?.count ?? 0;

    return { inserted, payload: res };
  });
  console.log(payload);
};

export const hsAhtn: Command = async (args) => {
  const flags = parseFlags(args);
  const url = args[0] ?? flags.url; // allow positional or --url
  const payload = await withRun(
    { importSource: 'AHTN', job: 'hs:ahtn', params: { url } },
    async () => {
      const res = await importAhtnAliases({ url });
      const inserted = res?.count ?? 0;

      return { inserted, payload: res };
    }
  );
  console.log(payload);
};

export const hsEuHs6: Command = async () => {
  const payload = await withRun({ importSource: 'TARIC', job: 'hs:eu-hs6' }, async () => {
    const res = await importEuHs6FromTaric();
    const inserted = Number(res?.count ?? 0);

    return { inserted, payload: res };
  });
  console.log(payload);
};

export const hsEuTaric: Command = async () => {
  const payload = await withRun({ importSource: 'TARIC', job: 'hs:euTaric' }, async () => {
    const res = await importEuAliasesFromTaric();
    const inserted = Number(res?.count ?? 0);

    return { inserted, payload: res };
  });
  console.log(payload);
};
