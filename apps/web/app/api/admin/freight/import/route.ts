import { NextResponse } from 'next/server';
import { importFreight } from '@/lib/freight';

export async function POST(req: Request) {
  const fd = await req.formData();
  const json = String(fd.get('json') ?? '[]');

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) throw new Error('Expected array of cards');

    await importFreight(parsed);

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'import failed' }, { status: 500 });
  }
}
