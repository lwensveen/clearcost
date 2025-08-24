import { NextResponse } from 'next/server';
import { setActive } from '@/lib/api-keys';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const fd = await req.formData();
  const ownerId = String(fd.get('ownerId') ?? '');
  const to = String(fd.get('to') ?? 'false') === 'true';

  try {
    await setActive(params.id, to);
  } catch {
    /* empty */
  }

  const url = new URL(`/admin/api-keys?ownerId=${ownerId}`, req.url);
  return NextResponse.redirect(url, 302);
}
