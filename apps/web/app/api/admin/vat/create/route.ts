import { NextResponse } from 'next/server';
import { createVAT } from '@/lib/vat';

export async function POST(req: Request) {
  const fd = await req.formData();
  const dest = String(fd.get('dest') ?? '');
  const ratePct = Number(fd.get('ratePct') ?? 0);
  const base = String(fd.get('base') ?? 'CIF_PLUS_DUTY') as 'CIF' | 'CIF_PLUS_DUTY';
  const effectiveFrom = String(fd.get('effectiveFrom') ?? '');
  const effectiveTo = fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null;
  const notes = fd.get('notes') ? String(fd.get('notes')) : null;

  try {
    await createVAT({ dest, ratePct, base, effectiveFrom, effectiveTo, notes });

    return NextResponse.redirect(new URL('/admin/vat', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'create failed' }, { status: 500 });
  }
}
