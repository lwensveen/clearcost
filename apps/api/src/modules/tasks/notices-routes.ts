// apps/api/src/modules/tasks/notices-routes.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { readFile } from 'node:fs/promises';
import { crawlAuthorityPdfs } from '../notices/crawl-authorities.js';
import { attachNoticeDoc, ensureNotice } from '../notices/registry.js';
import { NOTICE_TYPE_VALUES } from '@clearcost/db'; // single source of truth

type CnAuthority = 'MOF' | 'GACC' | 'MOFCOM';

const UA =
  process.env.NOTICES_USER_AGENT ??
  'clearcost-notices/1.0 (+https://clearcost.io; contact: support@clearcost.io)';

// Simple CSV env reader
function csvEnv(name: string, fallback = ''): string[] {
  return (process.env[name] ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Schema: defaults + normalization (so handler logic stays thin)
const BodySchema = z.object({
  urls: z.array(z.string().url()).optional(),
  includeHints: z.array(z.string()).optional(),
  excludeHints: z.array(z.string()).optional(),
  maxDepth: z.coerce.number().int().min(0).max(4).default(1),
  concurrency: z.coerce.number().int().min(1).max(10).default(4),
  outDir: z.string().optional(),
  dest: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .default('CN'),
  type: z.enum(NOTICE_TYPE_VALUES).default('general'),
  lang: z.string().min(2).max(8).default('zh'),
  tags: z.array(z.string()).optional(),
});
type Body = z.infer<typeof BodySchema>;

function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    const title = last
      .replace(/[-_]/g, ' ')
      .replace(/\.pdf$/i, '')
      .trim();
    return title || 'Untitled PDF';
  } catch {
    return 'Untitled PDF';
  }
}

export default function noticesRoutes(app: FastifyInstance) {
  async function handle(req: any, reply: any, authority: CnAuthority, seedsEnvKey: string) {
    const body: Body = BodySchema.parse(req.body ?? {});
    const importId = req.importCtx?.runId;

    const seedUrls = body.urls ?? csvEnv(seedsEnvKey);
    if (seedUrls.length === 0) {
      return reply.code(400).send({ ok: false, error: 'No seed URLs' });
    }

    const crawlResult = await crawlAuthorityPdfs({
      startUrls: seedUrls,
      maxDepth: body.maxDepth,
      concurrency: body.concurrency,
      includeHints: body.includeHints,
      excludeHints: body.excludeHints,
      outDir: body.outDir ?? process.env.NOTICES_OUT_DIR ?? undefined,
      userAgent: UA,
    });

    const { dest, type, lang } = body;
    const tags = body.tags ?? ['pdf-crawl', authority.toLowerCase()];

    const seenNoticeUrls = new Set<string>();
    let persistedNotices = 0;
    let attachedDocs = 0;
    let errors = 0;

    for (const file of crawlResult.files) {
      const fileUrl = file.url; // always string in CrawlFile
      try {
        const title = deriveTitleFromUrl(fileUrl);

        const notice = await ensureNotice({
          dest,
          authority,
          type,
          lang,
          title,
          url: fileUrl,
          publishedAt: null,
          effectiveFrom: null,
          effectiveTo: null,
          summary: null,
          tags,
        });

        if (!seenNoticeUrls.has(notice.url)) {
          seenNoticeUrls.add(notice.url);
          persistedNotices++;
        }

        // Attach PDF: prefer local dump; fallback to GET
        let bodyBuffer: Buffer | undefined;
        let mime: string | undefined;
        let bytes: number | undefined;

        if (file.path) {
          try {
            bodyBuffer = await readFile(file.path);
            bytes = bodyBuffer.length;
          } catch {
            /* fall through to fetch */
          }
        }

        if (!bodyBuffer) {
          try {
            const resp = await fetch(fileUrl, {
              headers: { 'user-agent': UA },
              redirect: 'follow',
            });
            if (resp.ok) {
              const ab = await resp.arrayBuffer();
              bodyBuffer = Buffer.from(ab);
              bytes = bodyBuffer.length;
              mime = resp.headers.get('content-type') ?? undefined;
            }
          } catch {
            /* ignore fetch errors for attachment */
          }
        }

        const doc = await attachNoticeDoc({
          noticeId: notice.id,
          url: fileUrl,
          mime: mime ?? null,
          bytes: bytes ?? null,
          body: bodyBuffer,
          storageRef: null,
        });

        if (doc) attachedDocs++;
      } catch {
        errors++;
      }
    }

    return reply.send({
      ok: true,
      importId,
      authority,
      seeds: seedUrls.length,
      found: crawlResult.found,
      downloaded: crawlResult.downloaded,
      skipped: crawlResult.skipped,
      persisted: { notices: persistedNotices, docs: attachedDocs, errors },
    });
  }

  // CN — MOF
  app.post(
    '/internal/cron/notices/cn/mof',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema },
      config: { importMeta: { importSource: 'CN_NOTICES', job: 'notices:cn-mof' } },
    },
    (req, reply) => handle(req, reply, 'MOF', 'CN_MOF_NOTICE_URLS')
  );

  // CN — GACC
  app.post(
    '/internal/cron/notices/cn/gacc',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema },
      config: { importMeta: { importSource: 'CN_NOTICES', job: 'notices:cn-gacc' } },
    },
    (req, reply) => handle(req, reply, 'GACC', 'CN_GACC_NOTICE_URLS')
  );

  // CN — MOFCOM
  app.post(
    '/internal/cron/notices/cn/mofcom',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema },
      config: { importMeta: { importSource: 'CN_NOTICES', job: 'notices:cn-mofcom' } },
    },
    (req, reply) => handle(req, reply, 'MOFCOM', 'CN_MOFCOM_NOTICE_URLS')
  );
}
