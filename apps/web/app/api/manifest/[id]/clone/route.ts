import { NextRequest, NextResponse } from 'next/server';
import { ManifestCloneResponseSchema } from '@clearcost/types';
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

  const r = await fetch(`${api}/v1/manifests/${id}/clone`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json' },
    cache: 'no-store',
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) return errorJson('Clone failed', r.status);

  const j = ManifestCloneResponseSchema.parse(raw);
  return NextResponse.json({ ok: true, id: j.id, itemsCopied: j.itemsCopied ?? 0 });
}
