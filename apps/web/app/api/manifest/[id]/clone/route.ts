import { NextRequest, NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const r = await fetch(`${API}/v1/manifests/${id}/clone`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json(j, { status: r.status });
  return NextResponse.json({ id: j.id, itemsCopied: j.itemsCopied ?? 0 });
}
