import { NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;
export async function GET() {
  const r = await fetch(`${API}/v1/manifests?limit=1`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });
  if (!r.ok) return new NextResponse(await r.text(), { status: r.status });
  const j = await r.json().catch(() => ({ items: [] as any[] }));
  return NextResponse.json({ count: j.items?.length ?? 0 });
}
