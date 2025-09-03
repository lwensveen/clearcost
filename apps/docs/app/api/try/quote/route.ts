import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API = (process.env.CLEARCOST_API_URL ?? '').replace(/\/$/, '');
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY ?? '';

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
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

export async function POST(req: NextRequest) {
  if (!API || !KEY) return bad('Server not configured');
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid JSON');
  }

  // Validate/normalize strictly (don’t forward raw user input)
  const origin = isoCc(body?.origin);
  const dest = isoCc(body?.dest);
  const amount = num(body?.itemValue?.amount, 0);
  const currency = String(body?.itemValue?.currency ?? 'USD').toUpperCase();
  const dims = {
    l: num(body?.dimsCm?.l, 0),
    w: num(body?.dimsCm?.w, 0),
    h: num(body?.dimsCm?.h, 0),
  };
  const weightKg = num(body?.weightKg, 0);
  const categoryKey = String(body?.categoryKey ?? 'general');
  const hs6 = String(body?.hs6 ?? '').trim() || undefined;
  const mode = body?.mode === 'sea' ? 'sea' : 'air';

  if (!origin || !dest || amount == null || !dims.l || !dims.w || !dims.h || weightKg == null) {
    return bad('Missing/invalid required fields');
  }

  const idem = 'ck_idem_' + crypto.randomUUID().replace(/-/g, '');

  const res = await fetch(`${API}/v1/quotes`, {
    method: 'POST',
    headers: {
      'x-api-key': KEY,
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
