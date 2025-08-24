const BASE = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_ADMIN_API_KEY!;

export type ApiKeyRow = {
  id: string;
  ownerId: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export async function listKeys(ownerId: string): Promise<ApiKeyRow[]> {
  const r = await fetch(`${BASE}/v1/api-keys?ownerId=${encodeURIComponent(ownerId)}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function createKey(
  ownerId: string,
  name: string,
  scopes: string[]
): Promise<{ id: string; token: string }> {
  const r = await fetch(`${BASE}/v1/api-keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ ownerId, name, scopes }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return { id: j.id, token: j.token as string };
}

export async function setActive(id: string, active: boolean): Promise<void> {
  const r = await fetch(`${BASE}/v1/api-keys/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ isActive: active }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
