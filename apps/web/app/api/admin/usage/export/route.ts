import { NextResponse } from 'next/server';
import { fetchUsageByKey, rowsToCSV } from '@/lib/billing';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function GET(req: Request) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const apiKeyId = searchParams.get('apiKeyId') || '';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  if (!apiKeyId) return errorJson('apiKeyId required', 400);

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
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'export failed', 500);
  }
}
