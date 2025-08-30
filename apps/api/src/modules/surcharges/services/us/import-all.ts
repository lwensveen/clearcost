import { importAphisAqiSurcharges } from './import-aphis-aqi.js';
import { importFdaFsmaSurcharges } from './import-fda-fsma.js';
import { importUsTradeRemediesFromHTS } from './import-usitc-hts.js';

type Opts = { batchSize?: number; importId?: string };

/** US “other surcharges”: APHIS AQI, FDA FSMA/VQIP, and Trade Remedies. */
export async function importAllUsSurcharges(opts: Opts = {}): Promise<{ ok: true; count: number }> {
  const batchSize = opts.batchSize;
  let count = 0;

  // APHIS AQI (carrier/arrival fees)
  const aphis = await importAphisAqiSurcharges({ batchSize, importId: opts.importId });
  count += aphis.count ?? 0;

  // FDA FSMA/VQIP
  const fda = await importFdaFsmaSurcharges({ batchSize, importId: opts.importId });
  count += fda.count ?? 0;

  // Trade Remedies 301/232 (program-level)
  const tr = await importUsTradeRemediesFromHTS({
    importId: opts.importId,
    batchSize,
    skipFree: true,
  });
  count += tr.count ?? 0;

  return { ok: true as const, count };
}
