import { NextRequest, NextResponse } from 'next/server';
import { deleteCard } from '@/lib/freight';
import { errorJson } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await deleteCard(id);

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'delete failed', 500);
  }
}
