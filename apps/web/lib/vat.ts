const BASE = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_ADMIN_API_KEY!;

export type VatRow = {
  id: string;
  dest: string;
  ratePct: string; // numeric in DB, string in TS
  base: 'CIF' | 'CIF_PLUS_DUTY';
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function listVAT(
  query: { dest?: string; limit?: number; offset?: number } = {}
): Promise<VatRow[]> {
  const params = new URLSearchParams();
  if (query.dest) params.set('dest', query.dest);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  const r = await fetch(`${BASE}/v1/vat?${params.toString()}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function createVAT(input: {
  dest: string;
  ratePct: number;
  base: 'CIF' | 'CIF_PLUS_DUTY';
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
}) {
  const r = await fetch(`${BASE}/v1/vat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<VatRow>;
}

export async function deleteVAT(id: string) {
  const r = await fetch(`${BASE}/v1/vat/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importVAT(
  rows: Array<{
    dest: string;
    ratePct: number;
    base: 'CIF' | 'CIF_PLUS_DUTY';
    effectiveFrom: string;
    effectiveTo?: string | null;
    notes?: string | null;
  }>
) {
  const r = await fetch(`${BASE}/v1/vat/import-json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ rows }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<{ inserted: number }>;
}
