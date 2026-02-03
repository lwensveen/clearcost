import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';

function getManifestProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { api, key } = getManifestProxyConfig();

  const r = await fetch(`${api}/v1/manifests/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  const raw = await r.json().catch(() => ({}));
  if (!r.ok) return errorJson('Delete failed', r.status);

  const Parsed = z.object({ ok: z.boolean().optional() });
  Parsed.parse(raw);
  return NextResponse.json({ ok: true });
}
