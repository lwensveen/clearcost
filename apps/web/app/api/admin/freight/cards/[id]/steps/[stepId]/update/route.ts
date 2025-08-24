import { NextResponse } from 'next/server';
import { updateStep } from '@/lib/freight';

export async function POST(req: Request, ctx: any) {
  const { id, stepId } = await ctx.params;
  const fd = await req.formData();
  const uptoQty = fd.get('uptoQty');
  const pricePerUnit = fd.get('pricePerUnit');

  try {
    await updateStep(id, stepId, {
      ...(uptoQty ? { uptoQty: Number(uptoQty) } : {}),
      ...(pricePerUnit ? { pricePerUnit: Number(pricePerUnit) } : {}),
    });

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'update failed' }, { status: 500 });
  }
}
