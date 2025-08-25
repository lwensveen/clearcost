import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getKeyOwner, setActive } from '@/lib/api-keys';

export async function POST(req: Request, ctx: any) {
  const { id } = await ctx.params;
  const session = await auth();
  const me = session?.user?.id as string | undefined;
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const to = String(fd.get('to') ?? 'false') === 'true';

  const ownerId = await getKeyOwner(id);
  if (ownerId !== me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await setActive(id, to);
  return NextResponse.redirect(new URL('/dashboard/api-keys', req.url), 302);
}
