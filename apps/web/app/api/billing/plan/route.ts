import { NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function GET() {
  const r = await fetch(`${API}/v1/billing/plan`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  const body = await r.text().catch(() => '');
  if (!r.ok) {
    return new NextResponse(body || 'Failed to load plan', { status: r.status });
  }
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
