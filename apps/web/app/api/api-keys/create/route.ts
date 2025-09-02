import { NextResponse } from 'next/server';
import { createKey } from '@/lib/api-keys';

export async function POST(req: Request) {
  const form = await req.formData();
  const ownerId = String(form.get('ownerId') ?? '');
  const name = String(form.get('name') ?? '');
  const scopesStr = String(form.get('scopes') ?? '');
  const scopes = scopesStr
    ? scopesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!ownerId || !name) {
    return NextResponse.json({ error: 'ownerId & name required' }, { status: 400 });
  }

  try {
    const { token } = await createKey(ownerId, name, scopes);

    return NextResponse.redirect(
      new URL(
        `/admin/api-keys?ownerId=${encodeURIComponent(ownerId)}&token=${encodeURIComponent(token)}`,
        req.url
      ),
      { status: 303 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to create key' }, { status: 500 });
  }
}
