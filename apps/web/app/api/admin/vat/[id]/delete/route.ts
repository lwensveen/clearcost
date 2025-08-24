import { NextResponse } from 'next/server';
import { deleteVAT } from '@/lib/vat';

export async function POST(req: Request, ctx: any) {
  const { id } = await ctx.params;

  try {
    await deleteVAT(id);

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
