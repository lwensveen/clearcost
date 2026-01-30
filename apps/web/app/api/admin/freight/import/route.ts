import { NextResponse } from 'next/server';
import { importFreight } from '@/lib/freight';
import { errorJson } from '@/lib/http';

export async function POST(req: Request) {
  const fd = await req.formData();
  const json = String(fd.get('json') ?? '[]');

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) throw new Error('Expected array of cards');

    await importFreight(parsed);

    return NextResponse.redirect(new URL('/admin/freight', req.url), 302);
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'import failed', 500);
  }
}
