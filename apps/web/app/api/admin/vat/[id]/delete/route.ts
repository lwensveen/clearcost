import { NextResponse } from 'next/server';
import { deleteVAT } from '@/lib/vat';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteVAT(params.id);

    return NextResponse.redirect(new URL('/admin/vat', _req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
