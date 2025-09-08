import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { importCnMfnFromPdf } from '../../../../modules/duty-rates/services/cn/import-mfn-pdf.js';

const boolParam = (b?: boolean) => (b ? '1' : undefined);

export const dutiesCnMfnPdf: Command = async (args) => {
  const flags = parseFlags(args);
  const urlOrPath = String(flags.url ?? flags.file ?? args?.[0] ?? '');
  if (!urlOrPath) throw new Error('Provide --url=<pdf> or --file=<path>');
  const pages = flags.pages ? String(flags.pages) : undefined;
  const mode = flags.mode as 'auto' | 'lattice' | 'stream' | undefined;
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun(
    {
      importSource: 'CN_TAXBOOK',
      job: 'duties:cn-mfn-pdf',
      params: { url: urlOrPath, pages, mode, dryRun: boolParam(dryRun) },
    },
    async (importId) => {
      const res = await importCnMfnFromPdf({ urlOrPath, pages, mode, dryRun, importId });
      return { inserted: res.inserted, payload: res };
    }
  );

  console.log(payload);
};
