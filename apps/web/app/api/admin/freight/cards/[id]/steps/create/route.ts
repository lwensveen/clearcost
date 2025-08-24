import { NextResponse } from 'next/server';
import { addStep } from '@/lib/freight';

export async function POST(req: Request, ctx: any) {
  const { id } = await ctx.params;
  const fd = await req.formData();
  const uptoQty = Number(fd.get('uptoQty') ?? 0);
  const pricePerUnit = Number(fd.get('pricePerUnit') ?? 0);

  try {
    await addStep(id, { uptoQty, pricePerUnit });

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'create step failed' }, { status: 500 });
  }
}
