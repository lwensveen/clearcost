import {
  db,
  NOTICE_STATUS_VALUES,
  NOTICE_TYPE_VALUES,
  tradeNoticeDocsTable,
  tradeNoticesTable,
} from '@clearcost/db';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

type TradeNoticeInsert = typeof tradeNoticesTable.$inferInsert;
type TradeNoticeSelect = typeof tradeNoticesTable.$inferSelect;
type TradeNoticeDocSelect = typeof tradeNoticeDocsTable.$inferSelect;

type NoticeType = (typeof NOTICE_TYPE_VALUES)[number];
type NoticeStatus = (typeof NOTICE_STATUS_VALUES)[number];

export async function ensureNotice(input: {
  dest: string; // ISO2, e.g., 'CN'
  authority: string; // 'MOF' | 'GACC' | 'MOFCOM' | etc
  type: NoticeType; // enum aligned with DB
  lang?: string;
  title: string;
  url: string;
  publishedAt?: Date | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  summary?: string | null;
  tags?: string[];
}): Promise<TradeNoticeSelect> {
  const normalized: TradeNoticeInsert = {
    dest: input.dest.toUpperCase(),
    authority: input.authority.trim().toUpperCase(),
    type: input.type,
    lang: input.lang ?? 'zh',
    title: input.title,
    url: input.url,
    publishedAt: input.publishedAt ?? null,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    status: 'new',
    summary: input.summary ?? null,
    tags: input.tags?.length ? input.tags : null,
  };

  const inserted = await db
    .insert(tradeNoticesTable)
    .values(normalized)
    .onConflictDoNothing({ target: tradeNoticesTable.url })
    .returning();

  if (inserted.length) return inserted[0]!;

  const existing = await db
    .select()
    .from(tradeNoticesTable)
    .where(eq(tradeNoticesTable.url, input.url))
    .limit(1);

  return existing[0]!;
}

export async function attachNoticeDoc(params: {
  noticeId: string;
  url: string;
  mime?: string | null;
  bytes?: number | null;
  body?: Buffer;
  storageRef?: string | null;
}): Promise<TradeNoticeDocSelect | undefined> {
  let sha256: string | null = null;
  let size: number | null = params.bytes ?? null;

  if (params.body) {
    sha256 = crypto.createHash('sha256').update(params.body).digest('hex');
    if (size == null) size = params.body.length;
  }

  const [doc] = await db
    .insert(tradeNoticeDocsTable)
    .values({
      noticeId: params.noticeId,
      url: params.url,
      mime: params.mime ?? null,
      bytes: size,
      sha256,
      storageRef: params.storageRef ?? null,
    })
    .onConflictDoNothing({ target: [tradeNoticeDocsTable.noticeId, tradeNoticeDocsTable.url] })
    .returning();

  return doc;
}

export async function markNoticeStatus(
  noticeId: string,
  status: NoticeStatus,
  error?: string | null
): Promise<void> {
  const now = new Date();
  await db
    .update(tradeNoticesTable)
    .set({
      status,
      parsedAt: status === 'parsed' ? now : null,
      error: error ?? null,
      updatedAt: now,
    })
    .where(eq(tradeNoticesTable.id, noticeId));
}
