import type { Command } from './runtime.js';
import { fxRefresh } from './commands/fx.js';
import { vatAuto } from './commands/vat.js';
import { dutiesJson } from './commands/duties/duties-json.js';
import { dutiesWits } from './commands/duties/duties-wits.js';
import { surchargesJson } from './commands/surcharges-json.js';
import {
  surchargesUsAll,
  surchargesUsAphis,
  surchargesUsFda,
  surchargesUsTradeRemedies,
} from './commands/surcharges-us.js';
import { freightJson } from './commands/freight.js';
import { hsAhtn, hsEuHs6, hsEuTaric, hsImportHs6, hsUk10, hsUsHts10 } from './commands/hs.js';
import { runSweepStale } from './commands/sweep-stale.js';
import { importsPrune } from './commands/prune.js';
import {
  deMinimisOfficial,
  deMinimisOpenAI,
  deMinimisSeedBaseline,
  deMinimisTradeGov,
  deMinimisZonos,
} from './commands/de-minimis.js';
import { dutiesUsAll, dutiesUsFta, dutiesUsMfn } from './commands/duties/duties-us.js';
import { programsLoadMembersCsv, programsSeed } from './commands/trade-programs.js';
import { seedCountriesBasic, seedTradeProgramsUS } from './commands/seed-trade-programs.js';
import {
  dutiesLlmCrossCheck,
  dutiesLlmGrok,
  dutiesLlmOpenAI,
} from './commands/duties/duties-llm.js';
import {
  surchargesLlmCrossCheck,
  surchargesLlmGrok,
  surchargesLlmOpenAI,
} from './commands/surcharges-llm.js';
import { vatLlmCrossCheck, vatLlmGrok, vatLlmOpenAI } from './commands/vat-llm.js';
import { dutiesEuBackfill, dutiesEuDaily } from './commands/duties/duties-eu.js';
import { dutiesJpAll, dutiesJpFta, dutiesJpMfn } from './commands/duties/duties-jp.js';
import { dutiesCnMfnPdf } from './commands/duties/duties-cn.js';
import { crawlNoticesCmd } from './commands/notices/notices.js';
import { fetchNoticeDocsCmd } from './commands/notices/docs.js';
import { crawlNoticesJsonCmd } from './commands/notices/json-feed.js';

export const commands: Record<string, Command> = {
  'fx:refresh': fxRefresh,
  'import:de-minimis:official': deMinimisOfficial,
  'import:de-minimis:openai': deMinimisOpenAI,
  'import:de-minimis:seed-baseline': deMinimisSeedBaseline,
  'import:de-minimis:trade-gov': deMinimisTradeGov,
  'import:de-minimis:zonos': deMinimisZonos,

  'import:duties': dutiesJson,
  'import:duties:cn-mfn-pdf': dutiesCnMfnPdf,
  'import:duties:eu-backfill': dutiesEuBackfill,
  'import:duties:eu-daily': dutiesEuDaily,
  'import:duties:jp-all': dutiesJpAll,
  'import:duties:jp-fta': dutiesJpFta,
  'import:duties:jp-mfn': dutiesJpMfn,
  'import:duties:llm-crosscheck': dutiesLlmCrossCheck,
  'import:duties:llm-grok': dutiesLlmGrok,
  'import:duties:llm-openai': dutiesLlmOpenAI,
  'import:duties:us-all': dutiesUsAll,
  'import:duties:us-fta': dutiesUsFta,
  'import:duties:us-mfn': dutiesUsMfn,
  'import:duties:wits': dutiesWits,

  'crawl:notices': crawlNoticesCmd,
  'crawl:notices:fetch-docs': fetchNoticeDocsCmd,
  'crawl:notices:json': crawlNoticesJsonCmd,

  'import:freight': freightJson,

  'import:hs6': hsImportHs6,
  'import:hs:ahtn': hsAhtn,
  'import:hs:eu-hs6': hsEuHs6,
  'import:hs:eu-taric': hsEuTaric,
  'import:hs:uk10': hsUk10,
  'import:hs:us-hts10': hsUsHts10,

  'import:programs:load-members': programsLoadMembersCsv,
  'import:programs:seed': programsSeed,

  'import:prune': importsPrune,

  'import:surcharges': surchargesJson,
  'import:surcharges:llm-crosscheck': surchargesLlmCrossCheck,
  'import:surcharges:llm-grok': surchargesLlmGrok,
  'import:surcharges:llm-openai': surchargesLlmOpenAI,
  'import:surcharges:us-all': surchargesUsAll,
  'import:surcharges:us-aphis': surchargesUsAphis,
  'import:surcharges:us-fda': surchargesUsFda,
  'import:surcharges:us-trade-remedies': surchargesUsTradeRemedies,

  'import:sweep-stale': runSweepStale,

  'import:vat': vatAuto,
  'import:vat:llm-openai': vatLlmOpenAI,
  'import:vat:llm-grok': vatLlmGrok,
  'import:vat:llm-crosscheck': vatLlmCrossCheck,

  'seed:countries:basic': seedCountriesBasic,
  'seed:trade-programs:us': seedTradeProgramsUS,
};
