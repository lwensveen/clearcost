import { NextResponse } from 'next/server';
import { fetchUsageByKey, rowsToCSV } from '@/lib/billing';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const apiKeyId = searchParams.get('apiKeyId') || '';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  if (!apiKeyId) return NextResponse.json({ error: 'apiKeyId required' }, { status: 400 });

  try {
    const rows = await fetchUsageByKey(apiKeyId, from, to);
    const csv = rowsToCSV(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="usage_${apiKeyId}_${from ?? 'start'}_${to ?? 'end'}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'export failed' }, { status: 500 });
  }
}
