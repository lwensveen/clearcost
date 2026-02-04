import { NextRequest, NextResponse } from 'next/server';
import { deleteStep } from '@/lib/freight';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const { id, stepId } = await params;

  try {
    await deleteStep(id, stepId);

    return NextResponse.redirect(new URL(`/admin/freight/${id}`, req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'delete failed', 500);
  }
}
