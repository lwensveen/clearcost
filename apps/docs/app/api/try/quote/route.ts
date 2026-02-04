import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getProxyConfig() {
  return {
    api: (process.env.CLEARCOST_API_URL ?? '').replace(/\/$/, ''),
    key: process.env.CLEARCOST_WEB_SERVER_KEY ?? '',
  };
}

function bad(msg: string, status = 400) {
  const code =
    status === 400
      ? 'ERR_BAD_REQUEST'
      : status === 403
        ? 'ERR_FORBIDDEN'
        : status >= 500
          ? 'ERR_INTERNAL'
          : 'ERR_REQUEST';
  return NextResponse.json({ error: { code, message: msg } }, { status });
}

function num(v: unknown, min = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : null;
}

function isoCc(v: unknown) {
  const s = String(v ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export async function POST(req: NextRequest) {
  const docsProxyEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS_PLAYGROUND_PROXY === '1';
  if (!docsProxyEnabled) return bad('Playground proxy is disabled', 403);

  const { api, key } = getProxyConfig();
  if (!api || !key) return bad('Server not configured');
  let body: Record<string, unknown> | null = null;
  try {
    const raw = await req.json();
    body = asRecord(raw);
  } catch {
    return bad('Invalid JSON');
  }

  // Validate/normalize strictly (don’t forward raw user input)
  const origin = isoCc(body?.origin);
  const dest = isoCc(body?.dest);
  const itemValue = asRecord(body?.itemValue);
  const dimsBody = asRecord(body?.dimsCm);
  const amount = num(itemValue?.amount, 0);
  const currency = String(itemValue?.currency ?? 'USD').toUpperCase();
  const dims = {
    l: num(dimsBody?.l, 0),
    w: num(dimsBody?.w, 0),
    h: num(dimsBody?.h, 0),
  };
  const weightKg = num(body?.weightKg, 0);
  const categoryKey = String(body?.categoryKey ?? 'general');
  const hs6 = String(body?.hs6 ?? '').trim() || undefined;
  const mode = body?.mode === 'sea' ? 'sea' : 'air';

  if (!origin || !dest || amount == null || !dims.l || !dims.w || !dims.h || weightKg == null) {
    return bad('Missing/invalid required fields');
  }

  const idem = 'ck_idem_' + crypto.randomUUID().replace(/-/g, '');

  const res = await fetch(`${api}/v1/quotes`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'content-type': 'application/json',
      'idempotency-key': idem,
    },
    body: JSON.stringify({
      origin,
      dest,
      itemValue: { amount, currency },
      dimsCm: dims,
      weightKg,
      categoryKey,
      hs6,
      mode,
    }),
    cache: 'no-store',
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
