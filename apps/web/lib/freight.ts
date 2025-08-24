'use server';

export type CardRow = {
  id: string;
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  carrier: string | null;
  service: string | null;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type StepRow = {
  id: string;
  cardId: string;
  uptoQty: string; // numeric in DB represented as string
  pricePerUnit: string; // numeric string
};

const BASE = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_ADMIN_API_KEY!;

export async function listCards(
  q: {
    origin?: string;
    dest?: string;
    mode?: 'air' | 'sea';
    unit?: 'kg' | 'm3';
    limit?: number;
    offset?: number;
  } = {}
): Promise<CardRow[]> {
  const p = new URLSearchParams();
  if (q.origin) p.set('origin', q.origin);
  if (q.dest) p.set('dest', q.dest);
  if (q.mode) p.set('mode', q.mode);
  if (q.unit) p.set('unit', q.unit);
  if (q.limit) p.set('limit', String(q.limit));
  if (q.offset) p.set('offset', String(q.offset));
  const r = await fetch(`${BASE}/v1/freight/cards?${p.toString()}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function createCard(input: {
  origin: string;
  dest: string;
  mode: 'air' | 'sea';
  unit: 'kg' | 'm3';
  carrier?: string | null;
  service?: string | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  const r = await fetch(`${BASE}/v1/freight/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<CardRow>;
}

export async function deleteCard(id: string) {
  const r = await fetch(`${BASE}/v1/freight/cards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function getSteps(cardId: string): Promise<StepRow[]> {
  const r = await fetch(`${BASE}/v1/freight/cards/${encodeURIComponent(cardId)}/steps`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function addStep(cardId: string, s: { uptoQty: number; pricePerUnit: number }) {
  const r = await fetch(`${BASE}/v1/freight/cards/${encodeURIComponent(cardId)}/steps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(s),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<StepRow>;
}

export async function updateStep(
  cardId: string,
  stepId: string,
  p: { uptoQty?: number; pricePerUnit?: number }
) {
  const r = await fetch(
    `${BASE}/v1/freight/cards/${encodeURIComponent(cardId)}/steps/${encodeURIComponent(stepId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(p),
    }
  );
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<StepRow>;
}

export async function deleteStep(cardId: string, stepId: string) {
  const r = await fetch(
    `${BASE}/v1/freight/cards/${encodeURIComponent(cardId)}/steps/${encodeURIComponent(stepId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${KEY}` },
    }
  );
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importFreight(
  cards: Array<{
    origin: string;
    dest: string;
    mode: 'air' | 'sea';
    unit: 'kg' | 'm3';
    carrier?: string | null;
    service?: string | null;
    notes?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
    steps?: Array<{ uptoQty: number; pricePerUnit: number }>;
  }>
) {
  const r = await fetch(`${BASE}/v1/freight/import-json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ cards }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<{ insertedCards: number; insertedSteps: number }>;
}
