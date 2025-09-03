import { NextResponse } from 'next/server';

export async function GET() {
  const api = process.env.CLEARCOST_API_URL!;
  const res = await fetch(`${api.replace(/\/$/, '')}/v1/_meta/openapi`, { cache: 'no-store' });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  });
}
