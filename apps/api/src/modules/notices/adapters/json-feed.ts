import { db, NOTICE_TYPE_VALUES, tradeNoticesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { httpFetch } from '../../../lib/http.js';

type NoticeType = (typeof NOTICE_TYPE_VALUES)[number];

export type JsonFeedOpts = {
  dest: string;
  authority: string;
  type?: NoticeType;
  lang?: string;
  url: string;
  arrayPath?: string;
  map: {
    title: (item: unknown) => string;
    url: (item: unknown) => string;
    publishedAt?: (item: unknown) => string | Date | undefined;
    summary?: (item: unknown) => string | undefined;
  };
  userAgent?: string;
};

function pickArray(root: unknown, path?: string): any[] {
  if (!path) return Array.isArray(root) ? (root as any[]) : [];
  const parts = path.split('.').filter(Boolean);
  let node: any = root;
  for (const p of parts) {
    node = node?.[p];
    if (!node) return [];
  }
  return Array.isArray(node) ? node : [];
}

function toDateOrNull(input: Date | string | undefined): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(+d) ? null : d;
}

export async function ingestJsonFeed(opts: JsonFeedOpts) {
  const ua =
    opts.userAgent ??
    process.env.HTTP_USER_AGENT ??
    'clearcost-bot/1.0 (+https://clearcost.io; tariff research; contact: support@clearcost.io)';

  const res = await httpFetch(opts.url, { headers: { 'user-agent': ua }, redirect: 'follow' });
  if (!res.ok) throw new Error(`JSON feed fetch failed ${res.status}`);
  const json = await res.json();

  const items = pickArray(json, opts.arrayPath);

  const dest = opts.dest.toUpperCase();
  const authority = opts.authority.trim().toUpperCase();
  const type: NoticeType = opts.type ?? 'general';
  const lang = opts.lang ?? 'zh';

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const rawTitle = opts.map.title(item);
    const rawUrl = opts.map.url(item);
    const title = rawTitle?.toString().trim();
    const noticeUrl = rawUrl?.toString().trim();
    if (!title || !noticeUrl) continue;

    const publishedAt = toDateOrNull(opts.map.publishedAt?.(item));
    const summary = opts.map.summary?.(item) ?? undefined;

    const ret = await db
      .insert(tradeNoticesTable)
      .values({
        dest,
        authority,
        type,
        lang,
        title,
        url: noticeUrl,
        status: 'new',
        publishedAt,
        summary: summary ?? null,
      })
      .onConflictDoUpdate({
        target: tradeNoticesTable.url,
        set: {
          title: sql`EXCLUDED.title`,
          publishedAt: sql`EXCLUDED.published_at`,
          summary: sql`EXCLUDED.summary`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ inserted: sql<number>`(xmax = 0)::int` });

    if (ret[0]?.inserted === 1) inserted++;
    else updated++;
  }

  return { ok: true as const, inserted, updated, count: inserted + updated };
}
