import { NextResponse } from 'next/server';
import { deleteStep } from '@/lib/freight';

export async function POST(_req: Request, { params }: { params: { id: string; stepId: string } }) {
  try {
    await deleteStep(params.id, params.stepId);

    return NextResponse.redirect(new URL(`/admin/freight/${params.id}`, _req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
