import { NextRequest, NextResponse } from 'next/server';
import { updateStep } from '@/lib/freight';
import { errorJson } from '@/lib/http';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { id, stepId } = await params;
  const fd = await req.formData();
  const uptoQty = fd.get('uptoQty');
  const pricePerUnit = fd.get('pricePerUnit');

  try {
    await updateStep(id, stepId, {
      ...(uptoQty ? { uptoQty: Number(uptoQty) } : {}),
      ...(pricePerUnit ? { pricePerUnit: Number(pricePerUnit) } : {}),
    });

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'update failed', 500);
  }
}
