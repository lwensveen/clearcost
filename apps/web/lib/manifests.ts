import { publicApi } from '@/lib/api-client';
import type { ManifestCreateInput } from '@clearcost/types';
import {
  Manifest,
  ManifestCoerced,
  ManifestItemCoerced,
  ManifestItemQuoteCoerced,
  ManifestQuoteCoerced,
} from '@clearcost/types';

export type ManifestFull = ManifestCoerced & {
  items: ManifestItemCoerced[];
  totals?: Record<string, number>;
  quote?: ManifestQuoteCoerced | null;
};

export type ManifestQuotesRes = {
  summary?: ManifestQuoteCoerced;
  items?: ManifestItemQuoteCoerced[];
};

export async function listManifests(params?: { limit?: number; cursor?: string }) {
  const api = publicApi();
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.cursor) qs.set('cursor', params.cursor);
  const path = `/v1/manifests${qs.toString() ? `?${qs.toString()}` : ''}`;
  return api.fetchJson<{ rows: ManifestCoerced[]; nextCursor?: string | null }>(path);
}

export async function createManifest(body: ManifestCreateInput) {
  const api = publicApi();
  return api.fetchJson(`/v1/manifests`, { method: 'POST', body: JSON.stringify(body) });
}

export async function getManifest(id: string) {
  const api = publicApi();
  return api.fetchJson<Manifest>(`/v1/manifests/${encodeURIComponent(id)}`);
}

export async function getManifestFull(id: string) {
  const api = publicApi();
  return api.fetchJson<ManifestFull>(`/v1/manifests/${encodeURIComponent(id)}/full`);
}

export async function exportItemsCsv(id: string) {
  const api = publicApi();
  const res = await api.fetchRaw(`/v1/manifests/${encodeURIComponent(id)}/items.csv`);
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${txt || 'export failed'}`);
  return txt;
}

export async function importItemsCsv(
  id: string,
  csv: string,
  opts?: { mode?: 'append' | 'replace'; dryRun?: boolean }
) {
  const api = publicApi();
  const q = new URLSearchParams();
  if (opts?.mode) q.set('mode', opts.mode);
  if (opts?.dryRun != null) q.set('dryRun', String(!!opts.dryRun));
  const path = `/v1/manifests/${encodeURIComponent(id)}/items:import-csv${
    q.toString() ? `?${q.toString()}` : ''
  }`;

  return api.fetchJson(path, {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    body: csv as any,
  }) as Promise<unknown>;
}

export async function computeManifest(
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight',
  opts?: { dryRun?: boolean }
) {
  const api = publicApi();
  const idem = api.genIdemKey();
  return api.fetchJson(`/v1/manifests/${encodeURIComponent(id)}/compute`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idem },
    body: JSON.stringify({ allocation, dryRun: !!opts?.dryRun }),
  }) as Promise<unknown>;
}

export async function getManifestQuotes(id: string) {
  const api = publicApi();
  return api.fetchJson<ManifestQuotesRes>(`/v1/manifests/${encodeURIComponent(id)}/quotes`);
}

export async function getManifestQuotesHistory(id: string) {
  const api = publicApi();
  return api.fetchJson<ManifestItemQuoteCoerced[]>(
    `/v1/manifests/${encodeURIComponent(id)}/quotes/history`
  );
}

export async function cloneManifest(id: string, name?: string) {
  const api = publicApi();
  return api.fetchJson(`/v1/manifests/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  }) as Promise<unknown>;
}

export async function deleteManifest(id: string) {
  const api = publicApi();
  return api.fetchJson<{ ok: true }>(`/v1/manifests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
