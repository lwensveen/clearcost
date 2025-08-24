import { NextResponse } from 'next/server';
import { deleteStep } from '@/lib/freight';

export async function POST(req: Request, ctx: any) {
  const { id, stepId } = await ctx.params;

  try {
    await deleteStep(id, stepId);

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
