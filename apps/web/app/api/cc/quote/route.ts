import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('manifestId');
  if (!id) return NextResponse.json({ error: 'manifestId required' }, { status: 400 });

  const r = await fetch(`${process.env.CLEARCOST_API_URL}/v1/manifests/${id}/quote`, {
    headers: { 'x-api-key': process.env.CLEARCOST_WEB_SERVER_KEY! },
    cache: 'no-store',
  });

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
  });
}
