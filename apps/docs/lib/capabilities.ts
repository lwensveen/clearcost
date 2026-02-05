import 'server-only';
import { MetaCapabilitiesResponseSchema, type MetaCapabilitiesResponse } from '@clearcost/types';

function normalizeBaseUrl() {
  const raw = process.env.CLEARCOST_API_URL ?? '';
  return raw.replace(/\/$/, '');
}

export async function fetchCapabilities(): Promise<MetaCapabilitiesResponse | null> {
  const apiBase = normalizeBaseUrl();
  if (!apiBase) return null;

  try {
    const res = await fetch(`${apiBase}/v1/_meta/capabilities`, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return MetaCapabilitiesResponseSchema.parse(json);
  } catch {
    return null;
  }
}
