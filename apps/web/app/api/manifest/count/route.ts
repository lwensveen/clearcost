import { NextResponse } from 'next/server';
import { ManifestsListResponseSchema } from '@clearcost/types';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';
import { requireSession } from '@/lib/route-auth';

function getManifestProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}
export async function GET(req: Request) {
  const authResult = await requireSession(req);
  if (!authResult.ok) return authResult.response;

  const { api, key } = getManifestProxyConfig();
  const r = await fetch(`${api}/v1/manifests?limit=1`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  if (!r.ok) return errorJson(await r.text(), r.status);
  const raw = await r.json().catch(() => ({ items: [] as unknown[] }));
  const j = ManifestsListResponseSchema.parse(raw);
  return NextResponse.json({ ok: true, count: j.items?.length ?? 0 });
}
