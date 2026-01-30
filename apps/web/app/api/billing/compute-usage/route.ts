import { NextResponse } from 'next/server';
import { errorJson } from '@/lib/http';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function GET() {
  const r = await fetch(`${API}/v1/billing/compute-usage`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  const body = await r.text();
  if (!r.ok) return errorJson(body || 'Failed to load usage', r.status);
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
