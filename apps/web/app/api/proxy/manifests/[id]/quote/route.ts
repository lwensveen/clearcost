import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const API = process.env.CLEARCOST_API_URL!;
  const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const r = await fetch(`${API}/v1/manifests/${encodeURIComponent(id)}/quote`, {
    method: 'POST',
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });

  const text = await r.text();
  const contentType = r.headers.get('content-type') || 'application/json';
  return new NextResponse(text, { status: r.status, headers: { 'content-type': contentType } });
}
