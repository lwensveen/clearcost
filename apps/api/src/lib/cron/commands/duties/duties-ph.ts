import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importPhMfnExcel } from '../../../../modules/duty-rates/services/asean/ph/import-mfn-excel.js';

export const dutiesPhMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const url = flags.url ?? args?.[0] ?? process.env.PH_TARIFF_EXCEL_URL;
  if (!url) throw new Error('Provide --url=... or set PH_TARIFF_EXCEL_URL');

  const payload = await withRun(
    {
      importSource: 'PH_TARIFF_COMMISSION',
      job: 'duties:ph-mfn-official',
      params: { url, sourceKey: 'duties.ph.tariff_commission.xlsx' },
    },
    async (importId) => {
      const res = await importPhMfnExcel({
        urlOrPath: url,
        importId,
        mapFreeToZero: true,
        skipSpecific: true,
      });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};
