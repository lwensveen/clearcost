import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importPhMfnExcel } from '../../../../modules/duty-rates/services/asean/ph/import-mfn-excel.js';
import { DUTIES_PH_MFN_SOURCE_KEY, resolvePhMfnExcelUrl } from './duties-ph-source-urls.js';

export const dutiesPhMfn: Command = async (args) => {
  const flags = parseFlags(args);
  const overrideUrl = flags.url ?? args?.[0];
  const { sourceKey, sourceUrl: url } = await resolvePhMfnExcelUrl({ overrideUrl });
  if (!url) {
    throw new Error(
      `Provide --url=... or set PH_TARIFF_EXCEL_URL, or configure source_registry key ${DUTIES_PH_MFN_SOURCE_KEY}`
    );
  }

  const payload = await withRun(
    {
      importSource: 'PH_TARIFF_COMMISSION',
      job: 'duties:ph-mfn-official',
      sourceKey,
      sourceUrl: url,
      params: { url, sourceKey },
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
