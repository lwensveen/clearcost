import 'server-only';
import {
  VatAdminCreateSchema,
  VatAdminImportJsonBodySchema,
  VatAdminImportJsonResponseSchema,
  VatAdminListQuerySchema,
  VatAdminListResponseSchema,
  VatRuleSelectCoercedSchema,
  type VatRuleCoerced,
} from '@clearcost/types';
import { z } from 'zod/v4';
import { requireEnvStrict } from './env';

function getAdminEnv() {
  return {
    base: requireEnvStrict('CLEARCOST_API_URL'),
    key: requireEnvStrict('CLEARCOST_ADMIN_API_KEY'),
  };
}

export type VatRow = VatRuleCoerced;

export async function listVAT(
  query: { dest?: string; limit?: number; offset?: number } = {}
): Promise<VatRow[]> {
  const { base, key } = getAdminEnv();
  const parsed = VatAdminListQuerySchema.parse(query);
  const params = new URLSearchParams();
  if (parsed.dest) params.set('dest', parsed.dest);
  if (parsed.limit) params.set('limit', String(parsed.limit));
  if (parsed.offset) params.set('offset', String(parsed.offset));
  const r = await fetch(`${base}/v1/admin/vat?${params.toString()}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return VatAdminListResponseSchema.parse(raw);
}

export async function createVAT(input: z.input<typeof VatAdminCreateSchema>) {
  const { base, key } = getAdminEnv();
  const payload = VatAdminCreateSchema.parse(input);
  const r = await fetch(`${base}/v1/admin/vat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return VatRuleSelectCoercedSchema.parse(raw);
}

export async function deleteVAT(id: string) {
  const { base, key } = getAdminEnv();
  const r = await fetch(`${base}/v1/admin/vat/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
}

export async function importVAT(rows: z.input<typeof VatAdminImportJsonBodySchema>['rows']) {
  const { base, key } = getAdminEnv();
  const payload = VatAdminImportJsonBodySchema.parse({ rows });
  const r = await fetch(`${base}/v1/admin/vat/import-json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = await r.json();
  return VatAdminImportJsonResponseSchema.parse(raw);
}
