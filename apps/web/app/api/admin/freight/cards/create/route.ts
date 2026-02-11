import { NextResponse } from 'next/server';
import { createCard } from '@/lib/freight';
import { errorJson } from '@/lib/http';
import { requireAdmin } from '@/lib/route-auth';

export async function POST(req: Request) {
  const authResult = await requireAdmin(req);
  if (!authResult.ok) return authResult.response;

  const fd = await req.formData();

  try {
    await createCard({
      origin: String(fd.get('origin') ?? ''),
      dest: String(fd.get('dest') ?? ''),
      freightMode: String(fd.get('mode') ?? 'air') as 'air' | 'sea',
      freightUnit: String(fd.get('unit') ?? 'kg') as 'kg' | 'm3',
      currency: String(fd.get('currency') ?? '').toUpperCase(),
      carrier: fd.get('carrier') ? String(fd.get('carrier')) : null,
      service: fd.get('service') ? String(fd.get('service')) : null,
      notes: fd.get('notes') ? String(fd.get('notes')) : null,
      effectiveFrom: String(fd.get('effectiveFrom') ?? ''),
      effectiveTo: fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null,
    });

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'create failed', 500);
  }
}
