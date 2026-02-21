import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importCnMfnFromPdf } from '../../../../modules/duty-rates/services/cn/import-mfn-pdf.js';
import { DUTIES_CN_MFN_PDF_SOURCE_KEY, resolveCnMfnPdfInput } from './duties-cn-source-urls.js';

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
      job: 'duties:cn-mfn-pdf',
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
