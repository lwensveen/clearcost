import { NextResponse } from 'next/server';
import { createSurcharge } from '@/lib/surcharges';

export async function POST(req: Request) {
  const fd = await req.formData();
  const dest = String(fd.get('dest') ?? '');
  const code = String(fd.get('code') ?? '');
  const fixedAmt = fd.get('fixedAmt') ? Number(fd.get('fixedAmt')) : undefined;
  const pctAmt = fd.get('pctAmt') ? Number(fd.get('pctAmt')) : undefined;
  const effectiveFrom = String(fd.get('effectiveFrom') ?? '');
  const effectiveTo = fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null;
  const notes = fd.get('notes') ? String(fd.get('notes')) : null;

  try {
    await createSurcharge({ dest, code, fixedAmt, pctAmt, effectiveFrom, effectiveTo, notes });

    return NextResponse.redirect(new URL('/admin/surcharges', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'create failed' }, { status: 500 });
  }
}
