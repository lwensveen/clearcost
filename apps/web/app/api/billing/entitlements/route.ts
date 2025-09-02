import { NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function GET() {
  const r = await fetch(`${API}/entitlements`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': 'application/json' },
  });
}
