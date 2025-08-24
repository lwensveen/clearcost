'use server';

export type SurchargeRow = {
  id: string;
  dest: string;
  code: string;
  fixedAmt: string | null;
  pctAmt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
};

const BASE = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_ADMIN_API_KEY!;

export async function listSurcharges(
  q: {
    dest?: string;
    code?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<SurchargeRow[]> {
  const p = new URLSearchParams();
  if (q.dest) p.set('dest', q.dest);
  if (q.code) p.set('code', q.code);
  if (q.limit) p.set('limit', String(q.limit));
  if (q.offset) p.set('offset', String(q.offset));
  const r = await fetch(`${BASE}/v1/surcharges?${p.toString()}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function createSurcharge(input: {
  dest: string;
  code: string;
  fixedAmt?: number | null;
  pctAmt?: number | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  const r = await fetch(`${BASE}/v1/surcharges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<SurchargeRow>;
}

export async function deleteSurcharge(id: string) {
  const r = await fetch(`${BASE}/v1/surcharges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importSurcharges(
  rows: Array<{
    dest: string;
    code: string;
    fixedAmt?: number | null;
    pctAmt?: number | null;
    notes?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>
) {
  const r = await fetch(`${BASE}/v1/surcharges/import-json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ rows }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<{ inserted: number }>;
}
