import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { errorJson } from '@/lib/http';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const r = await fetch(`${API}/v1/manifests/${id}/clone`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    cache: 'no-store',
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) return errorJson('Clone failed', r.status);

  const Parsed = z.object({
    id: z.string().uuid(),
    itemsCopied: z.number().int().optional(),
  });
  const j = Parsed.parse(raw);
  return NextResponse.json({ ok: true, id: j.id, itemsCopied: j.itemsCopied ?? 0 });
}
