import { NextResponse } from 'next/server';
import { deleteCard } from '@/lib/freight';

export async function POST(req: Request, ctx: any) {
  const { id } = await ctx.params;

  try {
    await deleteCard(id);

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
