import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const API = process.env.CLEARCOST_API_URL!;
  const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // fresh idempotency key per request
  const idem = 'ck_idem_' + crypto.randomUUID().replace(/-/g, '');

  const r = await fetch(`${API}/v1/quotes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'Idempotency-Key': idem,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await r.text();
  const contentType = r.headers.get('content-type') || 'application/json';

  return new NextResponse(text, {
    status: r.status,
    headers: { 'content-type': contentType, 'x-cc-idem': idem },
  });
}
