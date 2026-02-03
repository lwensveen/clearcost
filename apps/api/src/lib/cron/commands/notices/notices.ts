import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { crawlNotices } from '../../../../modules/notices/crawl.js';

export const crawlNoticesCmd: Command = async (argv) => {
  const flags = parseFlags(argv);

  const dest = String(flags.dest ?? 'CN'); // --dest CN
  const authority = String(flags.authority ?? 'MOF'); // --authority MOF
  const type = String(flags.type ?? 'general') as Parameters<typeof crawlNotices>[0]['type']; // --type general

  const urls = String(flags.urls ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!urls.length) {
    throw new Error('Provide at least one list URL via --urls <url1,url2,...>');
  }

  const include = flags.include
    ? String(flags.include)
        .split(',')
        .map((s) => s.trim())
    : undefined;
  const exclude = flags.exclude
    ? String(flags.exclude)
        .split(',')
        .map((s) => s.trim())
    : undefined;

  const attach = Boolean(flags.attach); // --attach to fetch PDFs and store as docs

  const result = await withRun(
    {
      importSource: 'CN_NOTICES',
      job: `notices:crawl:${authority.toLowerCase()}`,
      params: { dest, authority, type, seeds: urls.length, attach: Boolean(attach) },
    },
    async () => {
      const payload = await crawlNotices({
        dest,
        authority,
        type,
        urls,
        include,
        exclude,
        sameHostOnly: flags.sameHostOnly !== '0',
        attach,
      });
      return { inserted: payload.persisted ?? 0, payload };
    }
  );

  console.log(result);
};
