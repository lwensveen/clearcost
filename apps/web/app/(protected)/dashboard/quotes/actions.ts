'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createQuoteServer, getQuoteByKeyServer } from '@/lib/clearcost-server';
import type { QuoteInput } from '@clearcost/sdk';

const RECENT_KEY = 'cc:recent-quotes';

type RecentItem = { idem: string; at: number };

async function readRecent(): Promise<RecentItem[]> {
  const store = await cookies();
  const raw = store.get(RECENT_KEY)?.value;

  try {
    return (raw ? JSON.parse(raw) : []) as RecentItem[];
  } catch {
    return [];
  }
}

async function writeRecent(items: RecentItem[]) {
  const store = await cookies();
  const anyStore = store as unknown as { set?: (name: string, value: string, opts?: any) => void };

  if (typeof anyStore.set === 'function') {
    anyStore.set(RECENT_KEY, JSON.stringify(items.slice(0, 10)), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
}

export async function actionCreateQuote(formData: FormData) {
  const body: QuoteInput = {
    origin: String(formData.get('origin') || 'US'),
    dest: String(formData.get('dest') || 'DE'),
    itemValue: {
      amount: Number(formData.get('price') || 0),
      currency: String(formData.get('currency') || 'USD'),
    },
    dimsCm: {
      l: Number(formData.get('l') || 0),
      w: Number(formData.get('w') || 0),
      h: Number(formData.get('h') || 0),
    },
    weightKg: Number(formData.get('weight') || 0),
    categoryKey: String(formData.get('categoryKey') || 'general'),
    hs6: (String(formData.get('hs6') || '') || undefined) as string | undefined,
    mode: String(formData.get('mode') || 'air') as 'air' | 'sea',
  };

  const { quote, idempotencyKey } = await createQuoteServer(body);

  const items = (await readRecent()).filter((x) => x.idem !== idempotencyKey);
  items.unshift({ idem: idempotencyKey, at: Date.now() });
  await writeRecent(items);

  revalidatePath('/(protected)/dashboard/quotes');
  return { ok: true, quote, idempotencyKey };
}

export async function actionReplayByKey(idemKey: string) {
  const quote = await getQuoteByKeyServer(idemKey);

  return { ok: true, quote };
}

export async function getRecent() {
  return readRecent();
}
