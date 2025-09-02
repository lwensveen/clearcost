import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = process.env.CLEARCOST_API_URL!;
  const key = process.env.CLEARCOST_WEB_SERVER_KEY!;
  const r = await fetch(`${api}/v1/manifests/${id}/items.csv`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });

  const body = await r.arrayBuffer();
  const headers = new Headers({
    'content-type': r.headers.get('content-type') ?? 'text/csv; charset=utf-8',
    // force download
    'content-disposition':
      r.headers.get('content-disposition') ?? `attachment; filename="manifest-${id}-items.csv"`,
  });
  return new NextResponse(body, { status: r.status, headers });
}
