import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importCnMfnFromPdf } from '../../../../modules/duty-rates/services/cn/import-mfn-pdf.js';
import { importCnPreferential } from '../../../../modules/duty-rates/services/cn/import-preferential.js';
import { DUTIES_CN_MFN_PDF_SOURCE_KEY, resolveCnMfnPdfInput } from './duties-cn-source-urls.js';

const CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY = 'duties.cn.official.fta_excel';

const boolParam = (b?: boolean) => (b ? '1' : undefined);

export const dutiesCnMfnPdf: Command = async (args) => {
  const flags = parseFlags(args);
  const { sourceKey, sourceUrl, urlOrPath } = await resolveCnMfnPdfInput({
    overrideUrl: flags.url,
    overrideFile: flags.file,
    positional: args?.[0],
  });
  if (!urlOrPath) {
    throw new Error(
      `Provide --url=<pdf> or --file=<path>, or configure source_registry key ${DUTIES_CN_MFN_PDF_SOURCE_KEY}`
    );
  }
  const pages = flags.pages ? String(flags.pages) : undefined;
  const mode = flags.mode as 'auto' | 'lattice' | 'stream' | undefined;
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun(
    {
      importSource: 'CN_TAXBOOK',
      job: 'duties:cn-mfn-official',
      sourceKey,
      ...(sourceUrl ? { sourceUrl } : {}),
      params: {
        url: urlOrPath,
        pages,
        mode,
        dryRun: boolParam(dryRun),
        sourceKey,
        ...(sourceUrl ? { sourceUrl } : {}),
      },
    },
    async (importId) => {
      const res = await importCnMfnFromPdf({ urlOrPath, pages, mode, dryRun, importId });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};

export const dutiesCnFtaOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const hs6 = flags.hs6 ? String(flags.hs6).split(',').filter(Boolean) : undefined;
  const partnerGeoIds = flags.partners
    ? String(flags.partners).split(',').filter(Boolean)
    : undefined;
  const batchSize = flags.batchSize ? Number(flags.batchSize) : undefined;
  const sheet = flags.sheet ? String(flags.sheet) : undefined;
  const dryRun = Boolean(flags.dryRun);
  const officialExcelUrl = flags.url ? String(flags.url) : undefined;

  const payload = await withRun(
    {
      importSource: 'OFFICIAL',
      job: 'duties:cn-fta-official',
      sourceKey: CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY,
      ...(officialExcelUrl ? { sourceUrl: officialExcelUrl } : {}),
      params: {
        hs6,
        partners: partnerGeoIds,
        batchSize,
        sheet,
        dryRun: boolParam(dryRun),
        strictOfficial: '1',
        useWitsFallback: undefined,
        sourceKey: CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY,
        ...(officialExcelUrl ? { sourceUrl: officialExcelUrl } : {}),
      },
    },
    async (importId) => {
      const res = await importCnPreferential({
        hs6List: hs6,
        partnerGeoIds,
        batchSize,
        dryRun,
        sheet,
        strictOfficial: true,
        useWitsFallback: false,
        officialExcelUrl,
        importId,
      });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};
