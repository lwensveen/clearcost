'use server';
import 'server-only';

import {
  FreightCardAdminCreateSchema,
  FreightCardAdminImportJsonBodySchema,
  FreightCardAdminImportJsonResponseSchema,
  FreightCardsAdminListResponseSchema,
  FreightCardsAdminQuerySchema,
  FreightRateCardSelectCoercedSchema,
  FreightRateStepSelectCoercedSchema,
  FreightStepAdminCreateSchema,
  FreightStepAdminUpdateSchema,
  type FreightRateCardCoerced,
  type FreightRateStepCoerced,
} from '@clearcost/types';
import { z } from 'zod/v4';
import { requireEnvStrict } from './env';

export type CardRow = FreightRateCardCoerced;
export type StepRow = FreightRateStepCoerced;

function getAdminEnv() {
  return {
    base: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_ADMIN_API_KEY'),
  };
}

export async function listCards(
  q: {
    origin?: string;
    dest?: string;
    freightMode?: 'air' | 'sea';
    freightUnit?: 'kg' | 'm3';
    limit?: number;
    offset?: number;
  } = {}
): Promise<CardRow[]> {
  const { base, key } = getAdminEnv();
  const query = FreightCardsAdminQuerySchema.parse(q);
  const p = new URLSearchParams();
  if (query.origin) p.set('origin', query.origin);
  if (query.dest) p.set('dest', query.dest);
  if (query.freightMode) p.set('freightMode', query.freightMode);
  if (query.freightUnit) p.set('freightUnit', query.freightUnit);
  if (query.limit) p.set('limit', String(query.limit));
  if (query.offset) p.set('offset', String(query.offset));
  const r = await fetch(`${base}/v1/admin/freight/cards?${p.toString()}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return FreightCardsAdminListResponseSchema.parse(raw);
}

export async function createCard(input: z.input<typeof FreightCardAdminCreateSchema>) {
  const { base, key } = getAdminEnv();
  const payload = FreightCardAdminCreateSchema.parse(input);
  const r = await fetch(`${base}/v1/admin/freight/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return FreightRateCardSelectCoercedSchema.parse(raw);
}

export async function deleteCard(id: string) {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/freight/cards/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function getSteps(cardId: string): Promise<StepRow[]> {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/freight/cards/${encodeURIComponent(cardId)}/steps`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return z.array(FreightRateStepSelectCoercedSchema).parse(raw);
}

export async function addStep(cardId: string, s: z.infer<typeof FreightStepAdminCreateSchema>) {
  const { base, key } = getAdminEnv();
  const payload = FreightStepAdminCreateSchema.parse(s);
  const r = await fetch(`${base}/v1/admin/freight/cards/${encodeURIComponent(cardId)}/steps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return FreightRateStepSelectCoercedSchema.parse(raw);
}

export async function updateStep(
  cardId: string,
  stepId: string,
  p: z.infer<typeof FreightStepAdminUpdateSchema>
) {
  const { base, key } = getAdminEnv();
  const payload = FreightStepAdminUpdateSchema.parse(p);
  const r = await fetch(
    `${base}/v1/admin/freight/cards/${encodeURIComponent(cardId)}/steps/${encodeURIComponent(stepId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    }
  );
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return FreightRateStepSelectCoercedSchema.parse(raw);
}

export async function deleteStep(cardId: string, stepId: string) {
  const { base, key } = getAdminEnv();
  const r = await fetch(
    `${base}/v1/admin/freight/cards/${encodeURIComponent(cardId)}/steps/${encodeURIComponent(stepId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    }
  );
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importFreight(
  cards: z.input<typeof FreightCardAdminImportJsonBodySchema>['cards']
) {
  const { base, key } = getAdminEnv();
  const payload = FreightCardAdminImportJsonBodySchema.parse({ cards });
  const r = await fetch(`${base}/v1/admin/freight/import-json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return FreightCardAdminImportJsonResponseSchema.parse(raw);
}
