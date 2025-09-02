import { type NextRequest, NextResponse } from 'next/server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const r = await fetch(`${API}/v1/manifests/${id}/items.csv`, {
    headers: { 'x-api-key': KEY },
    cache: 'no-store',
  });

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="manifest-${id}-items.csv"`,
    },
  });
}
