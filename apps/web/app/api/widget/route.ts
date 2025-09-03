import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function reqIdem(req: NextRequest) {
  const h = req.headers.get('idempotency-key') || '';
  return typeof h === 'string' && h.length > 0 ? h : undefined;
}

export async function POST(req: NextRequest) {
  const API = process.env.CLEARCOST_API_URL!;
  const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;
  if (!API || !KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Fixed path (no user-controlled segments)
  const url = `${API.replace(/\/$/, '')}/v1/quotes`;

  const body = await req.text(); // pass-through
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': KEY,
      'content-type': 'application/json',
      // forward idempotency if provided
      ...(reqIdem(req) ? { 'idempotency-key': reqIdem(req)! } : {}),
    },
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  // mirror body + content-type + rate-limit headers
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'ratelimit-limit': res.headers.get('ratelimit-limit') ?? '',
      'ratelimit-remaining': res.headers.get('ratelimit-remaining') ?? '',
      'ratelimit-reset': res.headers.get('ratelimit-reset') ?? '',
    },
  });
}
