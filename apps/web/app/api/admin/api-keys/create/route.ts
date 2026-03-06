import { NextResponse } from 'next/server';
import { createKey } from '@/lib/api-keys';
import { requireAdmin } from '@/lib/route-auth';
import { errorJson } from '@/lib/http';

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

  if (!ownerId || !name) return errorJson('ownerId and name are required', 400);

  try {
    const { token } = await createKey(ownerId, name, scopes);
    return NextResponse.json({ token }, { status: 201 });
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'create failed', 500);
  }
}
