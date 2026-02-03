import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { parseFlags } from '../../utils.js';
import { ingestJsonFeed } from '../../../../modules/notices/adapters/json-feed.js';
import { NOTICE_TYPE_VALUES } from '@clearcost/db';
import { z } from 'zod/v4';

type NoticeType = (typeof NOTICE_TYPE_VALUES)[number];

const FlagsSchema = z.object({
  url: z.string().url(),
  dest: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .default('CN'),
  authority: z
    .string()
    .min(1)
    .transform((s) => s.trim().toUpperCase())
    .default('MOF'),
  type: z.enum(NOTICE_TYPE_VALUES).default('general' as NoticeType),
  arrayPath: z.string().optional(),
  titleKey: z.string().default('title'),
  urlKey: z.string().default('url'),
  publishedKey: z.string().optional(),
  summaryKey: z.string().optional(),
  lang: z.string().min(2).max(8).default('zh'),
  userAgent: z.string().optional(),
});

// minimal nested getter (supports dots + [idx])
const get = (obj: unknown, path?: string): unknown => {
  if (!path) return undefined;
  const parts = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur: any = obj;
  for (const p of parts) cur = cur?.[p];
  return cur;
};

export const crawlNoticesJsonCmd: Command = async (argv) => {
  const flags = FlagsSchema.parse(parseFlags(argv));

  const result = await withRun(
    {
      importSource: 'NOTICES',
      job: `notices:json:${flags.authority.toLowerCase()}`,
      params: { dest: flags.dest, authority: flags.authority, type: flags.type, url: flags.url },
    },
    async () => {
      const payload = await ingestJsonFeed({
        dest: flags.dest,
        authority: flags.authority,
        type: flags.type,
        lang: flags.lang,
        url: flags.url,
        arrayPath: flags.arrayPath,
        userAgent: flags.userAgent,
        map: {
          title: (item) => String(get(item, flags.titleKey) ?? ''),
          url: (item) => String(get(item, flags.urlKey) ?? ''),
          publishedAt: flags.publishedKey
            ? (item) => {
                const v = get(item, flags.publishedKey);
                return typeof v === 'string' || v instanceof Date ? v : undefined;
              }
            : undefined,
          summary: flags.summaryKey
            ? (item) => {
                const v = get(item, flags.summaryKey);
                return v == null ? undefined : String(v);
              }
            : undefined,
        },
      });

      return { inserted: payload.inserted ?? 0, payload };
    }
  );

  console.log(result);
};
