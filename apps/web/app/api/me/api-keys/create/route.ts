import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createKey } from '@/lib/api-keys';

export async function POST(req: Request) {
  const session = await auth();
  const ownerId = session?.user?.id as string | undefined;
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const name = String(fd.get('name') ?? '').trim();
  const scopes = String(fd.get('scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const token = await createKey(ownerId, name, scopes);
  return NextResponse.redirect(new URL(`/dashboard/api-keys?token=${token}`, req.url), 302);
}
