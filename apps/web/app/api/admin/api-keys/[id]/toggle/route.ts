import { NextRequest, NextResponse } from 'next/server';
import { setActive } from '@/lib/api-keys';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fd = await req.formData();

  const ownerId = String(fd.get('ownerId') ?? '');
  const to = String(fd.get('to') ?? 'false') === 'true';

  try {
    await setActive(id, to);
  } catch {
    // ignore toggle failures
  }

  const url = new URL(`/admin/api-keys?ownerId=${ownerId}`, req.url);
  return NextResponse.redirect(url, 302);
}
