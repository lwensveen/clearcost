import { NextRequest, NextResponse } from 'next/server';
import { addStep } from '@/lib/freight';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const fd = await req.formData();
  const uptoQty = Number(fd.get('uptoQty') ?? 0);
  const pricePerUnit = Number(fd.get('pricePerUnit') ?? 0);

  try {
    await addStep(id, { uptoQty, pricePerUnit });

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'create step failed', 500);
  }
}
