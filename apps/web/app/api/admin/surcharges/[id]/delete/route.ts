import { NextResponse } from 'next/server';
import { deleteSurcharge } from '@/lib/surcharges';

export async function POST(req: Request, ctx: any) {
  const { id } = await ctx.params;
  try {
    await deleteSurcharge(id);

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
