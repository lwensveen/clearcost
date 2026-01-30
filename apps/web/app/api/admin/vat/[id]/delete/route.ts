import { NextRequest, NextResponse } from 'next/server';
import { deleteVAT } from '@/lib/vat';
import { errorJson } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await deleteVAT(id);

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'delete failed', 500);
  }
}
