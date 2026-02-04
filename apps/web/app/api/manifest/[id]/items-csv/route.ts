import { NextRequest, NextResponse } from 'next/server';
import { exportManifestItemsCsv } from '@clearcost/sdk';
import { requireEnvStrict } from '@/lib/env';
import { requireSession } from '@/lib/route-auth';

function sdk() {
  const baseUrl = requireEnvStrict('CLEARCOST_API_URL');
  const apiKey = requireEnvStrict('CLEARCOST_WEB_SERVER_KEY');
  return { baseUrl, apiKey };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(req);
  if (!authResult.ok) return authResult.response;

  const { id } = await ctx.params;
  const csv = await exportManifestItemsCsv(sdk(), id);

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="manifest-${id}-items.csv"`,
      'cache-control': 'no-store',
    },
  });
}
