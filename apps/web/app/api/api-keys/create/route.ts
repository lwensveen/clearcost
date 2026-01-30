import { NextResponse } from 'next/server';
import { createKey } from '@/lib/api-keys';
import { errorJson } from '@/lib/http';

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
    return errorJson('ownerId & name required', 400);
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
  } catch (e: unknown) {
    return errorJson(e instanceof Error ? e.message : 'Failed to create key', 500);
  }
}
