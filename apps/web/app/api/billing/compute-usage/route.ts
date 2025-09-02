import { NextRequest, NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function GET(_req: NextRequest) {
  const r = await fetch(`${API}/v1/billing/compute-usage`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': 'application/json' },
  });
}
