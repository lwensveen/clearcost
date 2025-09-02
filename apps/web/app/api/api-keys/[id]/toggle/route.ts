import { NextResponse } from 'next/server';
import { setActive } from '@/lib/api-keys';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to toggle' }, { status: 500 });
  }
}
