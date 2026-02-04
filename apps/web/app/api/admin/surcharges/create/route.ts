import { NextResponse } from 'next/server';
import { createSurcharge } from '@/lib/surcharges';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: Request) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const fd = await req.formData();
  const dest = String(fd.get('dest') ?? '');
  const code = String(fd.get('code') ?? '');
  const fixedAmt = fd.get('fixedAmt') ? Number(fd.get('fixedAmt')) : undefined;
  const pctAmt = fd.get('pctAmt') ? Number(fd.get('pctAmt')) : undefined;
  const effectiveFrom = String(fd.get('effectiveFrom') ?? '');
  const effectiveTo = fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null;
  const notes = fd.get('notes') ? String(fd.get('notes')) : null;

  try {
    await createSurcharge({
      dest,
      surchargeCode: code,
      fixedAmt,
      pctAmt,
      effectiveFrom,
      effectiveTo,
      notes,
    });

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'create failed', 500);
  }
}
