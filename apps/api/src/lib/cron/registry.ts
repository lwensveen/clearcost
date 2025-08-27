import type { Command } from './runtime.js';
import { fxRefresh } from './commands/fx.js';
import { vatAuto } from './commands/vat.js';
import { dutiesJson } from './commands/duties-json.js';
import { dutiesWits } from './commands/duties-wits.js';
import { surchargesJson } from './commands/surcharges-json.js';
import { surchargesUsAll, surchargesUsTradeRemedies } from './commands/surcharges-us.js';
import { freightJson } from './commands/freight.js';
import { hsAhtn, hsEuHs6, hsImportHs6, hsUk10, hsUsHts10 } from './commands/hs.js';
import { runSweepStale } from './commands/sweep-stale.js';
import { importsPrune } from './commands/prune.js';

export const commands: Record<string, Command> = {
  'fx:refresh': fxRefresh,

  'import:vat': vatAuto,
  'import:duties': dutiesJson,
  'import:duties:wits': dutiesWits,

  'import:surcharges': surchargesJson,
  'import:surcharges:us-all': surchargesUsAll,
  'import:surcharges:us-trade-remedies': surchargesUsTradeRemedies,

  'import:freight': freightJson,

  'import:hs6': hsImportHs6,
  'import:hs:us-hts10': hsUsHts10,
  'import:hs:uk10': hsUk10,
  'import:hs:ahtn': hsAhtn,
  'import:hs/eu-hs6': hsEuHs6,

  'import:sweep-stale': runSweepStale,
  'import:prune': importsPrune,
};
