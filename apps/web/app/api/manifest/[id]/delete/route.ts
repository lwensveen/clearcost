import { NextRequest, NextResponse } from 'next/server';
import { ManifestOkResponseSchema } from '@clearcost/types';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';
import { requireSession } from '@/lib/route-auth';

function getManifestProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireSession(req);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const { api, key } = getManifestProxyConfig();

  const r = await fetch(`${api}/v1/manifests/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) return errorJson('Delete failed', r.status);

  ManifestOkResponseSchema.parse(raw);
  return NextResponse.json({ ok: true });
}
