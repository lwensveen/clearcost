import { db, tradeNoticeDocsTable, tradeNoticesTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

// Drizzle-inferred types from your schema
type TradeNoticeInsert = typeof tradeNoticesTable.$inferInsert;
type TradeNoticeSelect = typeof tradeNoticesTable.$inferSelect;
type TradeNoticeDocSelect = typeof tradeNoticeDocsTable.$inferSelect;

type NoticeType = TradeNoticeInsert['type']; // 'general' | 'tariff' | 'fta' | 'surcharge'
type NoticeStatus = TradeNoticeSelect['status']; // 'new' | 'parsed' | 'superseded' | 'invalid'

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
  tags?: string[]; // JSONB array
}): Promise<TradeNoticeSelect> {
  // De-dup by URL (unique index)
  const [existing] = await db
    .select()
    .from(tradeNoticesTable)
    .where(eq(tradeNoticesTable.url, input.url))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(tradeNoticesTable)
    .values({
      dest: input.dest.toUpperCase(),
      authority: input.authority.trim(),
      type: input.type,
      lang: input.lang ?? 'zh',
      title: input.title,
      url: input.url,
      publishedAt: input.publishedAt ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      status: 'new',
      summary: input.summary ?? null,
      tags: input.tags && input.tags.length ? (input.tags as unknown as object) : null,
    })
    .returning();

  // Non-null assertion is safe because returning() with insert yields 1 row
  return created!;
}

export async function attachNoticeDoc(params: {
  noticeId: string;
  url: string;
  mime?: string | null;
  bytes?: number | null;
  body?: Buffer; // optional: if you fetched it here
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
    .onConflictDoNothing()
    .returning();

  // If it already existed (conflict), returning() may be empty => undefined
  return doc;
}

export async function markNoticeStatus(
  noticeId: string,
  status: NoticeStatus, // 'new' | 'parsed' | 'superseded' | 'invalid'
  error?: string | null
): Promise<void> {
  // We only set parsedAt when moving to 'parsed'. Other timestamps are not auto-updated here.
  await db
    .update(tradeNoticesTable)
    .set({
      status,
      parsedAt: status === 'parsed' ? new Date() : null,
      error: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tradeNoticesTable.id, noticeId));
}
