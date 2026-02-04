import { NextRequest, NextResponse } from 'next/server';
import { setActive } from '@/lib/api-keys';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

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
