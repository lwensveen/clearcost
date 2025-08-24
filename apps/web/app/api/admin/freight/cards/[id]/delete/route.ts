import { NextResponse } from 'next/server';
import { deleteCard } from '@/lib/freight';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCard(params.id);

    return NextResponse.redirect(new URL('/admin/freight', _req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
