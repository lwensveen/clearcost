import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { errorJson } from '@/lib/http';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;
export async function GET() {
  const r = await fetch(`${API}/v1/manifests?limit=1`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  if (!r.ok) return errorJson(await r.text(), r.status);
  const raw = await r.json().catch(() => ({ items: [] as unknown[] }));
  const Parsed = z.object({ items: z.array(z.unknown()).optional() });
  const j = Parsed.parse(raw);
  return NextResponse.json({ ok: true, count: j.items?.length ?? 0 });
}
