import { NextResponse } from 'next/server';
import { createCard } from '@/lib/freight';

export async function POST(req: Request) {
  const fd = await req.formData();

  try {
    await createCard({
      origin: String(fd.get('origin') ?? ''),
      dest: String(fd.get('dest') ?? ''),
      mode: String(fd.get('mode') ?? 'air') as 'air' | 'sea',
      unit: String(fd.get('unit') ?? 'kg') as 'kg' | 'm3',
      carrier: fd.get('carrier') ? String(fd.get('carrier')) : null,
      service: fd.get('service') ? String(fd.get('service')) : null,
      notes: fd.get('notes') ? String(fd.get('notes')) : null,
      effectiveFrom: String(fd.get('effectiveFrom') ?? ''),
      effectiveTo: fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null,
    });

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'create failed' }, { status: 500 });
  }
}
