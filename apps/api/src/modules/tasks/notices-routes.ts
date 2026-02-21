// apps/api/src/modules/tasks/notices-routes.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { readFile } from 'node:fs/promises';
import { crawlAuthorityPdfs } from '../notices/crawl-authorities.js';
import { attachNoticeDoc, ensureNotice } from '../notices/registry.js';
import { resolveCnNoticeSeedUrls, type CnNoticeAuthority } from '../notices/source-urls.js';
import { ErrorResponseSchema, TasksNoticesCrawlBodySchema } from '@clearcost/types';
import { httpFetch } from '../../lib/http.js';
import { errorResponseForStatus } from '../../lib/errors.js';

const UA =
  process.env.NOTICES_USER_AGENT ??
  'clearcost-notices/1.0 (+https://clearcost.io; contact: support@clearcost.io)';

// Schema: defaults + normalization (so handler logic stays thin)
const BodySchema = TasksNoticesCrawlBodySchema;
type Body = z.infer<typeof TasksNoticesCrawlBodySchema>;

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
  async function handle(req: any, reply: any, authority: CnNoticeAuthority) {
    const body: Body = BodySchema.parse(req.body ?? {});
    const importId = req.importCtx?.runId;
    const {
      sourceKey,
      sourceUrl,
      urls: seedUrls,
    } = await resolveCnNoticeSeedUrls({
      authority,
      explicitUrls: body.urls,
    });
    if (seedUrls.length === 0) {
      return reply.code(400).send(errorResponseForStatus(400, 'No seed URLs'));
    }
    if (req.importCtx) {
      req.importCtx.runPatch = {
        ...req.importCtx.runPatch,
        sourceKey,
        sourceUrl: sourceUrl ?? seedUrls[0],
      };
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
            const resp = await httpFetch(fileUrl, {
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
      sourceKey,
      seeds: seedUrls.length,
      found: crawlResult.found,
      downloaded: crawlResult.downloaded,
      skipped: crawlResult.skipped,
      persisted: { notices: persistedNotices, docs: attachedDocs, errors },
    });
  }

  // CN — MOF
  app.post(
    '/cron/notices/cn/mof',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema, response: { 400: ErrorResponseSchema } },
      config: {
        importMeta: {
          importSource: 'CN_NOTICES',
          job: 'notices:cn-mof',
          sourceKey: 'notices.cn.mof.list',
        },
      },
    },
    (req, reply) => handle(req, reply, 'MOF')
  );

  // CN — GACC
  app.post(
    '/cron/notices/cn/gacc',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema, response: { 400: ErrorResponseSchema } },
      config: {
        importMeta: {
          importSource: 'CN_NOTICES',
          job: 'notices:cn-gacc',
          sourceKey: 'notices.cn.gacc.list',
        },
      },
    },
    (req, reply) => handle(req, reply, 'GACC')
  );

  // CN — MOFCOM
  app.post(
    '/cron/notices/cn/mofcom',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { body: BodySchema, response: { 400: ErrorResponseSchema } },
      config: {
        importMeta: {
          importSource: 'CN_NOTICES',
          job: 'notices:cn-mofcom',
          sourceKey: 'notices.cn.mofcom.list',
        },
      },
    },
    (req, reply) => handle(req, reply, 'MOFCOM')
  );
}
