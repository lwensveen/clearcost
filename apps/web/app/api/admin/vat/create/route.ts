import { NextResponse } from 'next/server';
import { createVAT } from '@/lib/vat';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: Request) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const fd = await req.formData();
  const dest = String(fd.get('dest') ?? '');
  const ratePct = Number(fd.get('ratePct') ?? 0);
  const vatBase = String(fd.get('base') ?? 'CIF_PLUS_DUTY') as 'CIF' | 'CIF_PLUS_DUTY';
  const effectiveFrom = String(fd.get('effectiveFrom') ?? '');
  const effectiveTo = fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null;
  const notes = fd.get('notes') ? String(fd.get('notes')) : null;

  try {
    await createVAT({ dest, ratePct, vatBase, effectiveFrom, effectiveTo, notes });

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'create failed', 500);
  }
}
