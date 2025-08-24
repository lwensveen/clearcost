import { NextResponse } from 'next/server';
import { addStep } from '@/lib/freight';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const fd = await req.formData();
  const uptoQty = Number(fd.get('uptoQty') ?? 0);
  const pricePerUnit = Number(fd.get('pricePerUnit') ?? 0);

  try {
    await addStep(params.id, { uptoQty, pricePerUnit });

    return NextResponse.redirect(new URL(`/admin/freight/${params.id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'create step failed' }, { status: 500 });
  }
}
