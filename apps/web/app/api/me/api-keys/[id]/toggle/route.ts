import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/auth';
import { getKeyOwner, setActive } from '@/lib/api-keys';
import { errorJson } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  const me = session?.user?.id as string | undefined;
  if (!me) return errorJson('Unauthorized', 401);

  const fd = await req.formData();
  const to = String(fd.get('to') ?? 'false') === 'true';

  const ownerId = await getKeyOwner(id);
  if (ownerId !== me) return errorJson('Forbidden', 403);

  await setActive(id, to);
  return NextResponse.redirect(new URL('/dashboard/api-keys', req.url), 302);
}
