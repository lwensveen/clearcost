import { publicApi } from '@/lib/api-client';
import type { Org, OrgSettingsCoerced } from '@clearcost/types';

export type OrgSettingsResult = {
  org: Pick<Org, 'id' | 'name'>;
  settings: OrgSettingsCoerced;
};

export async function fetchOrgSettings(): Promise<OrgSettingsResult> {
  const api = publicApi();
  return api.fetchJson<OrgSettingsResult>('/v1/orgs/self/settings');
}

export async function updateOrgSettings(input: {
  name: string;
  billingEmail?: string | null;
  defaultCurrency: string;
  taxId?: string | null;
  webhookUrl?: string | null;
}): Promise<OrgSettingsResult> {
  const api = publicApi();
  const idem = api.genIdemKey();
  return api.fetchJson<OrgSettingsResult>('/v1/orgs/self/settings', {
    method: 'PUT',
    headers: { 'Idempotency-Key': idem },
    body: JSON.stringify(input),
  });
}

export async function rotateOrgWebhook(): Promise<{ ok: true; secret: string }> {
  const api = publicApi();
  const idem = api.genIdemKey();
  return api.fetchJson<{ ok: true; secret: string }>('/v1/orgs/self/settings/rotate-webhook', {
    method: 'POST',
    headers: { 'Idempotency-Key': idem },
  });
}
