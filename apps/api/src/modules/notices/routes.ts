import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { db, tradeNoticeDocsTable, tradeNoticesTable } from '@clearcost/db';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import {
  TradeNoticeByIdSchema,
  TradeNoticeDetailResponseSchema,
  TradeNoticeDocSelectCoercedSchema,
  TradeNoticeErrorResponseSchema,
  TradeNoticeSelectCoercedSchema,
  TradeNoticesListQuerySchema,
  TradeNoticesListResponseSchema,
} from '@clearcost/types';

export default function noticesBrowseRoutes(app: FastifyInstance) {
  app.get(
    '/notices',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: {
        querystring: TradeNoticesListQuerySchema,
        response: { 200: TradeNoticesListResponseSchema },
      },
      config: { importMeta: { importSource: 'NOTICES', job: 'notices:list' } },
    },
    async (req, reply) => {
      const query = TradeNoticesListQuerySchema.parse(req.query ?? {});
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
      const limitNum = limit ?? 50;
      const offsetNum = offset ?? 0;
      const sortKey = sort ?? 'publishedAt';
      const dirKey = dir ?? 'desc';

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
          .map((s: string) => s.trim())
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
        sortKey === 'createdAt'
          ? tradeNoticesTable.createdAt
          : sortKey === 'updatedAt'
            ? tradeNoticesTable.updatedAt
            : tradeNoticesTable.publishedAt;

      const orderExpr = dirKey === 'asc' ? orderCol : desc(orderCol);

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
        .limit(limitNum)
        .offset(offsetNum);

      const totalRow = await db
        .select({ total: sql<number>`count(*)` })
        .from(tradeNoticesTable)
        .where(and(...(conditions.length ? conditions : [sql`true`])));

      const total = totalRow[0]?.total ?? 0;

      return reply.send(
        TradeNoticesListResponseSchema.parse({
          ok: true,
          total,
          limit: limitNum,
          offset: offsetNum,
          items: items.map((it) => TradeNoticeSelectCoercedSchema.parse(it)),
          nextOffset: offsetNum + items.length < total ? offsetNum + items.length : null,
        })
      );
    }
  );

  app.get(
    '/notices/:id',
    {
      preHandler: app.requireApiKey(['tasks:notices']),
      schema: {
        params: TradeNoticeByIdSchema,
        response: {
          200: TradeNoticeDetailResponseSchema,
          404: TradeNoticeErrorResponseSchema,
        },
      },
      config: { importMeta: { importSource: 'NOTICES', job: 'notices:get' } },
    },
    async (req, reply) => {
      const { id } = TradeNoticeByIdSchema.parse(req.params ?? {});

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

      return reply.send(
        TradeNoticeDetailResponseSchema.parse({
          ok: true,
          notice: TradeNoticeSelectCoercedSchema.parse(notice),
          docs: docs.map((d) => TradeNoticeDocSelectCoercedSchema.parse(d)),
        })
      );
    }
  );
}
