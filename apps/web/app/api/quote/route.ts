import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

const ALLOWED_HOSTS = new Set<string>([new URL(API_BASE).hostname]);

function isSafeManifestId(v: string): boolean {
  return /^[0-9A-Za-z-]{1,64}$/.test(v) && !v.includes('/') && !v.includes('..');
}

export async function GET(req: NextRequest) {
  const idRaw = req.nextUrl.searchParams.get('manifestId')?.trim() ?? '';
  if (!isSafeManifestId(idRaw)) {
    return NextResponse.json({ error: 'manifestId invalid' }, { status: 400 });
  }

  let base: URL;
  try {
    base = new URL(API_BASE);
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!ALLOWED_HOSTS.has(base.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 500 });
  }

  const url = new URL(base.toString());
  const cleanBasePath = base.pathname.replace(/\/+$/, '');
  url.pathname = `${cleanBasePath}/v1/manifests/${encodeURIComponent(idRaw)}/quote`;

  let r: Response;
  try {
    r = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'x-api-key': KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
