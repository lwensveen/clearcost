import { NextRequest, NextResponse } from 'next/server';
import { setActive } from '@/lib/api-keys';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const form = await req.formData();
  const ownerId = String(form.get('ownerId') ?? '');
  const to = String(form.get('to') ?? '');
  const active = to === 'true';

  try {
    await setActive(id, active);
    return NextResponse.redirect(
      new URL(`/admin/api-keys?ownerId=${encodeURIComponent(ownerId)}`, req.url),
      { status: 303 }
    );
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'Failed to toggle', 500);
  }
}
