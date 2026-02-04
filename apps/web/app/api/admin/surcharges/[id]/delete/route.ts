import { NextRequest, NextResponse } from 'next/server';
import { deleteSurcharge } from '@/lib/surcharges';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  try {
    await deleteSurcharge(id);

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'delete failed', 500);
  }
}
