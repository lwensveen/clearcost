'use server';

import { revalidateTag } from 'next/cache';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

const API_BASE = new URL(API);
const ALLOWED_HOSTS = new Set<string>([API_BASE.hostname]);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function assertId(raw: string, label = 'id'): string {
  const id = String(raw ?? '').trim();
  if (!ID_RE.test(id)) throw new Error(`Invalid ${label}`);
  return id;
}

function buildApiUrl(
  path: string,
  qs?: Record<string, string | number | boolean | null | undefined>
): URL {
  const url = new URL(path, API_BASE);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('Refused external API host');
  if (qs) {
    for (const [k, v] of Object.entries(qs)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function safeApiError(r: Response, fallback: string): Promise<string> {
  try {
    const data = await r.json();
    const msg = (data && (data.error || data.message)) || '';
    if (typeof msg === 'string' && msg) return msg.slice(0, 300);
  } catch {
    // ignore
  }
  try {
    const txt = await r.text();
    if (txt) return txt.slice(0, 300);
  } catch {
    // ignore
  }
  return fallback;
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'x-api-key': KEY, ...extra };
}

export async function computeAction(
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight' = 'chargeable'
) {
  const safeId = assertId(id, 'manifest id');
  const allowedAlloc = new Set(['chargeable', 'volumetric', 'weight']);
  const alloc = allowedAlloc.has(allocation) ? allocation : 'chargeable';

  const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}/compute`);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders({ 'content-type': 'application/json' }),
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ allocation: alloc, dryRun: false }),
    cache: 'no-store',
  });

  if (!r.ok) {
    const msg = await safeApiError(
      r,
      r.status === 402 ? 'Plan limit exceeded' : `Compute failed (${r.status})`
    );
    if (r.status === 402) throw new Error(msg);
    throw new Error(msg);
  }

  revalidateTag(`manifest:${safeId}`);
  revalidateTag(`manifest:${safeId}:quote`);
}

export async function createManifestAction(input: {
  name: string;
  origin?: string;
  dest?: string;
  mode?: 'air' | 'sea' | string;
  pricingMode?: 'chargeable' | 'volumetric' | 'weight' | string;
}) {
  const url = buildApiUrl('/v1/manifests');
  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Failed to create manifest'));
  const { id } = await r.json();
  revalidateTag('manifests');
  return id as string;
}

export type ImportCsvState =
  | {
      ok: true;
      result: {
        mode: 'append' | 'replace';
        dryRun: boolean;
        valid: number;
        invalid: number;
        inserted: number;
        replaced?: number;
        errors: Array<{ line: number; message: string }>;
      };
      error?: undefined;
    }
  | { ok: false; error: string; result?: undefined };

export async function importCsvAction(
  id: string,
  _prev: ImportCsvState | undefined,
  formData: FormData
): Promise<ImportCsvState> {
  try {
    const file = formData.get('file') as File | null;
    if (!file) return { ok: false, error: 'CSV file is required' };

    const modeRaw = (formData.get('mode') as string) ?? 'append';
    const mode = modeRaw === 'replace' ? 'replace' : 'append';
    const dryRun = formData.get('dryRun') === 'on';

    const csv = await file.text();

    const safeId = assertId(id, 'manifest id');
    const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}/items:import-csv`, {
      mode,
      dryRun,
    });

    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'text/csv' }),
      body: csv,
      cache: 'no-store',
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (json && (json.error || json.message)) || `Import failed (${r.status})`;
      return { ok: false, error: String(msg).slice(0, 300) };
    }

    if (!dryRun) {
      revalidateTag(`manifest:${safeId}`);
    }

    return { ok: true, result: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Import failed' };
  }
}

export type ManifestItemInput = {
  reference?: string | null;
  notes?: string | null;
  hs6?: string | null;
  categoryKey?: string | null;
  itemValueAmount: string | number; // DB numeric → send as string or number
  itemValueCurrency: string; // e.g. 'USD'
  weightKg?: string | number; // DB numeric → send as string or number
  dimsCm?: { l?: number; w?: number; h?: number } | null;
};

/**
 * Replace all items with the provided list.
 * Accepts any array-ish of items (from /full), picks only schema fields, and optionally dry-runs.
 */
export async function replaceItemsAction(
  id: string,
  itemsRaw: any[],
  dryRun = false
): Promise<{ ok: true; replaced: number } | { ok: false; error: string }> {
  try {
    const safeId = assertId(id, 'manifest id');

    const items: ManifestItemInput[] = (itemsRaw ?? []).map((it: any) => ({
      reference: it.reference ?? null,
      notes: it.notes ?? null,
      hs6: it.hs6 ?? null,
      categoryKey: it.categoryKey ?? null,
      itemValueAmount: it.itemValueAmount ?? '0',
      itemValueCurrency: it.itemValueCurrency ?? 'USD',
      weightKg: it.weightKg ?? '0',
      dimsCm: it.dimsCm
        ? { l: Number(it.dimsCm.l ?? 0), w: Number(it.dimsCm.w ?? 0), h: Number(it.dimsCm.h ?? 0) }
        : { l: 0, w: 0, h: 0 },
    }));

    const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}/items:replace`);
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ items, dryRun }),
      cache: 'no-store',
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (json && (json.error || json.message)) || `Replace failed (${r.status})`;
      return { ok: false, error: String(msg).slice(0, 300) };
    }

    if (!dryRun) {
      revalidateTag(`manifest:${safeId}`);
    }
    return { ok: true, replaced: json.replaced ?? items.length };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Replace failed' };
  }
}

/** Convenience: clear all items (replace with empty list) */
export async function clearAllItemsAction(id: string) {
  return await replaceItemsAction(id, [], false);
}

export async function cloneManifestAction(id: string, name?: string): Promise<string> {
  const safeId = assertId(id, 'manifest id');
  const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}/clone`);
  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(name ? { name } : {}),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Clone failed'));
  const j = await r.json();
  revalidateTag('manifests');
  return j.id as string;
}

export async function deleteManifestAction(id: string) {
  const safeId = assertId(id, 'manifest id');
  const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}`);
  const r = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Delete failed'));
  revalidateTag('manifests');
}

export async function patchManifestAction(
  id: string,
  patch: Partial<{
    name: string;
    origin: string;
    dest: string;
    shippingMode: 'air' | 'sea';
    pricingMode: 'cards' | 'fixed';
    fixedFreightTotal: string | number | null;
    fixedFreightCurrency: string | null;
    reference: string | null;
  }>
) {
  const safeId = assertId(id, 'manifest id');
  const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}`);
  const r = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Update failed'));
  revalidateTag(`manifest:${safeId}`);
  revalidateTag('manifests');
}

export async function updateItemAction(
  manifestId: string,
  itemId: string,
  patch: Partial<{
    reference: string | null;
    notes: string | null;
    hs6: string | null;
    categoryKey: string | null;
    itemValueAmount: string | number;
    itemValueCurrency: string;
    weightKg: string | number;
    dimsCm: { l?: number; w?: number; h?: number } | null;
  }>
) {
  const safeManifestId = assertId(manifestId, 'manifest id');
  const safeItemId = assertId(itemId, 'item id');

  const url = buildApiUrl(
    `/v1/manifests/${encodeURIComponent(safeManifestId)}/items/${encodeURIComponent(safeItemId)}`
  );

  const r = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Update failed'));
  revalidateTag(`manifest:${safeManifestId}`);
  revalidateTag(`manifest:${safeManifestId}:quote`);
}

export async function deleteItemAction(manifestId: string, itemId: string) {
  const safeManifestId = assertId(manifestId, 'manifest id');
  const safeItemId = assertId(itemId, 'item id');

  const url = buildApiUrl(
    `/v1/manifests/${encodeURIComponent(safeManifestId)}/items/${encodeURIComponent(safeItemId)}`
  );

  const r = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Delete failed'));
  revalidateTag(`manifest:${safeManifestId}`);
  revalidateTag(`manifest:${safeManifestId}:quote`);
}

export async function updateManifestAction(
  id: string,
  patch: Partial<{
    name: string;
    origin: string;
    dest: string;
    shippingMode: 'air' | 'sea';
    pricingMode: 'cards' | 'fixed';
    fixedFreightTotal: string | number | null;
    fixedFreightCurrency: string | null;
    reference: string | null;
  }>
) {
  const safeId = assertId(id, 'manifest id');
  const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}`);
  const r = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Update failed'));
  revalidateTag(`manifest:${safeId}`);
  revalidateTag('manifests');
}
