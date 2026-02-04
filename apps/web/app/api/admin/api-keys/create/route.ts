import { NextResponse } from 'next/server';
import { createKey } from '@/lib/api-keys';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: Request) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const fd = await req.formData();
  const ownerId = String(fd.get('ownerId') ?? '');
  const name = String(fd.get('name') ?? '');
  const scopesRaw = String(fd.get('scopes') ?? '');
  const scopes = scopesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!ownerId || !name) return NextResponse.redirect(new URL('/admin/api-keys', req.url), 302);

  try {
    const { token } = await createKey(ownerId, name, scopes);
    const url = new URL(
      `/admin/api-keys?ownerId=${ownerId}&token=${encodeURIComponent(token)}`,
      req.url
    );

    return NextResponse.redirect(url, 302);
  } catch (e: unknown) {
    const url = new URL(`/admin/api-keys?ownerId=${ownerId}`, req.url);

    url.searchParams.set('error', e instanceof Error ? e.message : 'create failed');

    return NextResponse.redirect(url, 302);
  }
}
