import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireEnvStrict } from '@/lib/env';
import { errorJson } from '@/lib/http';

function getManifestProxyConfig() {
  return {
    api: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'),
  };
}
export async function GET() {
  const { api, key } = getManifestProxyConfig();
  const r = await fetch(`${api}/v1/manifests?limit=1`, {
    headers: { 'x-api-key': key },
    cache: 'no-store',
  });
  if (!r.ok) return errorJson(await r.text(), r.status);
  const raw = await r.json().catch(() => ({ items: [] as unknown[] }));
  const Parsed = z.object({ items: z.array(z.unknown()).optional() });
  const j = Parsed.parse(raw);
  return NextResponse.json({ ok: true, count: j.items?.length ?? 0 });
}
