import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const api = process.env.CLEARCOST_API_URL!;
  const serverKey = process.env.CLEARCOST_WEB_SERVER_KEY!;

  const r = await fetch(`${api}/v1/quotes/by-key/${encodeURIComponent(key)}`, {
    headers: { 'x-api-key': serverKey },
    cache: 'no-store',
  });

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
      'x-idempotent-replayed': r.headers.get('idempotent-replayed') ?? '',
    },
  });
}
