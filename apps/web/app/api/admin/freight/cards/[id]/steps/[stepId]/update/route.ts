import { NextResponse } from 'next/server';
import { updateStep } from '@/lib/freight';

export async function POST(req: Request, { params }: { params: { id: string; stepId: string } }) {
  const fd = await req.formData();
  const uptoQty = fd.get('uptoQty');
  const pricePerUnit = fd.get('pricePerUnit');

  try {
    await updateStep(params.id, params.stepId, {
      ...(uptoQty ? { uptoQty: Number(uptoQty) } : {}),
      ...(pricePerUnit ? { pricePerUnit: Number(pricePerUnit) } : {}),
    });

    return NextResponse.redirect(new URL(`/admin/freight/${params.id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'update failed' }, { status: 500 });
  }
}
