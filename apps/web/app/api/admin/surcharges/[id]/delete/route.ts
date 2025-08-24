import { NextResponse } from 'next/server';
import { deleteSurcharge } from '@/lib/surcharges';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteSurcharge(params.id);

    return NextResponse.redirect(new URL('/admin/surcharges', _req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
