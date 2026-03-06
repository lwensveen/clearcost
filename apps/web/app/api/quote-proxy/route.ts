import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/rate-limit';

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

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

function requestIdempotencyKey(req: NextRequest): string | null {
  const idempotencyKey = req.headers.get('idempotency-key')?.trim();
  if (idempotencyKey) return idempotencyKey;

  const legacyHeader = req.headers.get('x-idempotency-key')?.trim();
  if (legacyHeader) return legacyHeader;

  return null;
}

export async function POST(req: NextRequest) {
  if (
    await isRateLimited(
      `quote-proxy:${getClientIp(req)}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS
    )
  ) {
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
