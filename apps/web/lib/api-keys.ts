import 'server-only';
import {
  ApiKeyAdminGetResponseSchema,
  ApiKeyAdminListResponseSchema,
  ApiKeyCreateResponseSchema,
  ApiKeyPublicSchema,
} from '@clearcost/types';
import { z } from 'zod/v4';
import { requireEnvStrict } from './env';

function getAdminEnv() {
  return {
    base: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_ADMIN_API_KEY'),
  };
}

export type ApiKeyRow = z.infer<typeof ApiKeyPublicSchema>;

export async function listKeys(ownerId: string): Promise<ApiKeyRow[]> {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/api-keys?ownerId=${encodeURIComponent(ownerId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return ApiKeyAdminListResponseSchema.parse(raw);
}

export async function createKey(
  ownerId: string,
  name: string,
  scopes: string[]
): Promise<{ id: string; token: string }> {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/api-keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ ownerId, name, scopes }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  const j = ApiKeyCreateResponseSchema.parse(raw);
  return { id: j.id, token: j.token };
}

export async function getKeyOwner(id: string): Promise<string | null> {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/api-keys/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });

  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);

  const raw = await r.json();
  const j = ApiKeyAdminGetResponseSchema.parse(raw);
  return j.ownerId ?? null;
}

export async function setActive(id: string, active: boolean): Promise<void> {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/api-keys/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ isActive: active }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
