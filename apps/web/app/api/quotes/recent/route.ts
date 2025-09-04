import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = url.searchParams.get('limit') ?? '50';
  const sinceHours = url.searchParams.get('sinceHours') ?? '';

  const api = process.env.CLEARCOST_API_URL!;
  const key = process.env.CLEARCOST_WEB_SERVER_KEY!;
  const target = `${api}/v1/quotes/recent?limit=${encodeURIComponent(limit)}${
    sinceHours ? `&sinceHours=${encodeURIComponent(sinceHours)}` : ''
  }`;

  const r = await fetch(target, { headers: { 'x-api-key': key }, cache: 'no-store' });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
