import { NextRequest, NextResponse } from 'next/server';

type RateLimitEntry = {
  count: number;
  windowStartMs: number;
};

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitByIp = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const xRealIp = req.headers.get('x-real-ip')?.trim();
  if (xRealIp) return xRealIp;

  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitByIp.get(ip);

  if (!existing || now - existing.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    rateLimitByIp.set(ip, { count: 1, windowStartMs: now });
    return false;
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX) return true;
  rateLimitByIp.set(ip, existing);
  return false;
}

function requestIdempotencyKey(req: NextRequest): string | null {
  const idempotencyKey = req.headers.get('idempotency-key')?.trim();
  if (idempotencyKey) return idempotencyKey;

  const legacyHeader = req.headers.get('x-idempotency-key')?.trim();
  if (legacyHeader) return legacyHeader;

  return null;
}

export async function POST(req: NextRequest) {
  if (isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const baseUrl = process.env.CLEARCOST_API_BASE_URL?.trim();
  // Keep playground traffic on a dedicated demo key; do not use production integration keys here.
  const apiKey = process.env.CLEARCOST_DEMO_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: 'misconfigured_proxy' }, { status: 500 });
  }

  const body = await req.text();
  const idempotencyKey = requestIdempotencyKey(req);
  const upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/quotes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body,
    cache: 'no-store',
  });

  const responseText = await upstream.text();

  return new NextResponse(responseText, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
