import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, tradeNoticeDocsTable, tradeNoticesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { NoticeStatus, NoticeType, TradeNotice, TradeNoticeDoc } from '@clearcost/types';

const QuerySchema = z.object({
  dest: z.string().length(2).optional(),
  authority: z.string().min(1).optional(), // e.g. "MOF", "GACC", "MOFCOM"
  type: NoticeType.optional(),
  status: NoticeStatus.optional(),
  lang: z.string().min(2).max(8).optional(),
  q: z.string().min(1).optional(), // full-text-ish on title/url
  tags: z.string().optional(), // comma-separated; all must be present
  publishedFrom: z.coerce.date().optional(),
  publishedTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['publishedAt', 'createdAt', 'updatedAt']).default('publishedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export default function noticesBrowseRoutes(app: FastifyInstance) {
  app.get(
    '/internal/notices',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { querystring: QuerySchema },
      config: { importMeta: { importSource: 'NOTICES', job: 'notices:list' } },
    },
    async (req, reply) => {
      const query = QuerySchema.parse(req.query ?? {});
      const {
        dest,
        authority,
        type,
        status,
        lang,
        q,
        tags,
        publishedFrom,
        publishedTo,
        limit,
        offset,
        sort,
        dir,
      } = query;

      const conditions = [];

      if (dest) conditions.push(eq(tradeNoticesTable.dest, dest.toUpperCase()));
      if (authority) conditions.push(eq(tradeNoticesTable.authority, authority));
      if (type) conditions.push(eq(tradeNoticesTable.type, type));
      if (status) conditions.push(eq(tradeNoticesTable.status, status));
      if (lang) conditions.push(eq(tradeNoticesTable.lang, lang));

      if (publishedFrom) conditions.push(gte(tradeNoticesTable.publishedAt, publishedFrom));
      if (publishedTo) conditions.push(lte(tradeNoticesTable.publishedAt, publishedTo));

      if (q) {
        const like = `%${q}%`;
        conditions.push(
          or(ilike(tradeNoticesTable.title, like), ilike(tradeNoticesTable.url, like))
        );
      }

      if (tags) {
        const tagList = tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const tag of tagList) {
          conditions.push(sql`${tradeNoticesTable.tags} @> ${JSON.stringify([tag])}::jsonb`);
        }
      }

      const docsCount = db
        .select({
          noticeId: tradeNoticeDocsTable.noticeId,
          cnt: sql<number>`count(*)`,
        })
        .from(tradeNoticeDocsTable)
        .groupBy(tradeNoticeDocsTable.noticeId)
        .as('dc');

      const orderCol =
        sort === 'createdAt'
          ? tradeNoticesTable.createdAt
          : sort === 'updatedAt'
            ? tradeNoticesTable.updatedAt
            : tradeNoticesTable.publishedAt;

      const orderExpr = dir === 'asc' ? orderCol : desc(orderCol);

      const items = await db
        .select({
          id: tradeNoticesTable.id,
          dest: tradeNoticesTable.dest,
          authority: tradeNoticesTable.authority,
          type: tradeNoticesTable.type,
          lang: tradeNoticesTable.lang,
          title: tradeNoticesTable.title,
          url: tradeNoticesTable.url,
          publishedAt: tradeNoticesTable.publishedAt,
          effectiveFrom: tradeNoticesTable.effectiveFrom,
          effectiveTo: tradeNoticesTable.effectiveTo,
          status: tradeNoticesTable.status,
          sha256: tradeNoticesTable.sha256,
          fetchedAt: tradeNoticesTable.fetchedAt,
          parsedAt: tradeNoticesTable.parsedAt,
          tags: tradeNoticesTable.tags,
          docs: sql<number>`COALESCE(${docsCount.cnt}, 0)`.as('docs'),
        })
        .from(tradeNoticesTable)
        .leftJoin(docsCount, eq(tradeNoticesTable.id, docsCount.noticeId))
        .where(and(...(conditions.length ? conditions : [sql`true`])))
        .orderBy(orderExpr)
        .limit(limit)
        .offset(offset);

      const totalRow = await db
        .select({ total: sql<number>`count(*)` })
        .from(tradeNoticesTable)
        .where(and(...(conditions.length ? conditions : [sql`true`])));

      const total = totalRow[0]?.total ?? 0;

      return reply.send({
        ok: true,
        total,
        limit,
        offset,
        items: items as unknown as TradeNotice[],
        nextOffset: offset + items.length < total ? offset + items.length : null,
      });
    }
  );

  app.get(
    '/internal/notices/:id',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: { params: z.object({ id: z.string().uuid() }) },
      config: { importMeta: { importSource: 'NOTICES', job: 'notices:get' } },
    },
    async (req, reply) => {
      const { id } = (req.params ?? {}) as { id: string };

      const [notice] = await db
        .select()
        .from(tradeNoticesTable)
        .where(eq(tradeNoticesTable.id, id))
        .limit(1);

      if (!notice) return reply.code(404).send({ ok: false, error: 'Not found' });

      const docs = await db
        .select()
        .from(tradeNoticeDocsTable)
        .where(eq(tradeNoticeDocsTable.noticeId, id))
        .orderBy(desc(tradeNoticeDocsTable.createdAt));

      return reply.send({
        ok: true,
        notice: notice as unknown as TradeNotice,
        docs: docs as unknown as TradeNoticeDoc[],
      });
    }
  );
}
