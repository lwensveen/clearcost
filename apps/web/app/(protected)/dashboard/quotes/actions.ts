'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { create, getByKey } from '@/lib/quotes';
import { QuoteInputSchema } from '@clearcost/types';
import { z } from 'zod/v4';

const RECENT_KEY = 'cc:recent-quotes';
const RecentCookieSchema = z.array(
  z.object({
    idem: z.string(),
    at: z.number(),
  })
);

function readRecentCookie(raw?: string | undefined) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return RecentCookieSchema.parse(parsed);
  } catch {
    return [];
  }
}

export async function actionCreateQuote(fd: FormData) {
  const body = QuoteInputSchema.parse({
    origin: String(fd.get('origin') || 'US'),
    dest: String(fd.get('dest') || 'DE'),
    itemValue: {
      amount: Number(fd.get('price') || 0),
      currency: String(fd.get('currency') || 'USD'),
    },
    dimsCm: {
      l: Number(fd.get('l') || 0),
      w: Number(fd.get('w') || 0),
      h: Number(fd.get('h') || 0),
    },
    weightKg: Number(fd.get('weight') || 0),
    categoryKey: String(fd.get('categoryKey') || 'general'),
    hs6: (String(fd.get('hs6') || '') || undefined) as string | undefined,
    mode: String(fd.get('mode') || 'air') as 'air' | 'sea',
  });

  const { quote, idempotencyKey } = await create(body);

  // put a lightweight “recent” breadcrumb in a cookie so UI feels instant
  const jar = await cookies();
  const existing = readRecentCookie(jar.get(RECENT_KEY)?.value);
  const updated = [
    { idem: idempotencyKey, at: Date.now() },
    ...existing.filter((x) => x.idem !== idempotencyKey),
  ].slice(0, 10);
  jar.set?.(RECENT_KEY, JSON.stringify(updated), { httpOnly: true, sameSite: 'lax', path: '/' });

  revalidatePath('//dashboard/quotes');
  return { ok: true, quote, idempotencyKey };
}

export async function actionReplayByKey(idemKey: string) {
  const quote = await getByKey(idemKey);
  return { ok: true, quote };
}
