import { NextResponse } from 'next/server';
import { getAuth } from '@/auth';
import { createKey } from '@/lib/api-keys';
import { errorJson } from '@/lib/http';

export async function POST(req: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  const ownerId = session?.user?.id as string | undefined;
  if (!ownerId) return errorJson('Unauthorized', 401);

  const fd = await req.formData();
  const name = String(fd.get('name') ?? '').trim();
  const scopes = String(fd.get('scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const { token } = await createKey(ownerId, name, scopes);
    return NextResponse.json({ token }, { status: 201 });
  } catch (e: unknown) {
    console.error('API key creation error:', e);
    return errorJson(e instanceof Error ? e.message : 'create failed', 500);
  }
}
