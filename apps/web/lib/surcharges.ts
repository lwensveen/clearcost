'use server';
import 'server-only';

import {
  SurchargeSelectCoercedSchema,
  SurchargesAdminImportResponseSchema,
  SurchargesAdminListQuerySchema,
  SurchargesAdminListResponseSchema,
  type SurchargeCoerced,
} from '@clearcost/types';
import { requireEnvStrict } from './env';

export type SurchargeRow = SurchargeCoerced;

function getAdminEnv() {
  return {
    base: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_ADMIN_API_KEY'),
  };
}

export async function listSurcharges(
  q: {
    dest?: string;
    surchargeCode?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<SurchargeRow[]> {
  const { base, key } = getAdminEnv();
  const parsed = SurchargesAdminListQuerySchema.parse(q);
  const p = new URLSearchParams();
  if (parsed.dest) p.set('dest', parsed.dest);
  if (parsed.surchargeCode) p.set('surchargeCode', parsed.surchargeCode);
  if (parsed.limit) p.set('limit', String(parsed.limit));
  if (parsed.offset) p.set('offset', String(parsed.offset));
  const r = await fetch(`${base}/v1/admin/surcharges?${p.toString()}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return SurchargesAdminListResponseSchema.parse(raw);
}

export async function createSurcharge(input: {
  dest: string;
  surchargeCode: string;
  fixedAmt?: number | null;
  pctAmt?: number | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/surcharges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return SurchargeSelectCoercedSchema.parse(raw);
}

export async function deleteSurcharge(id: string) {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/surcharges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importSurcharges(
  rows: Array<{
    dest: string;
    surchargeCode: string;
    fixedAmt?: number | null;
    pctAmt?: number | null;
    notes?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>
) {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/surcharges/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return SurchargesAdminImportResponseSchema.parse(raw);
}
