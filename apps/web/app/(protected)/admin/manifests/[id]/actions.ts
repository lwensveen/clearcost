'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod/v4';
import { extractErrorMessage, formatError } from '@/lib/errors';
import { requireEnvStrict } from '@/lib/env';

function getApiConfig() {
  const api = requireEnvStrict('CLEARCOST_API_URL');
  const key = requireEnvStrict('CLEARCOST_WEB_SERVER_KEY');
  const base = new URL(api);
  return { api, key, base, allowedHosts: new Set<string>([base.hostname]) };
}

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
  const { base, allowedHosts } = getApiConfig();
  const url = new URL(path, base);
  if (!allowedHosts.has(url.hostname)) throw new Error('Refused external API host');
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
    const msg = extractErrorMessage(data, '');
    if (msg) return msg.slice(0, 300);
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
  const { key } = getApiConfig();
  return { 'x-api-key': key, ...extra };
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

  revalidateTag(`manifest:${safeId}`, 'default');
  revalidateTag(`manifest:${safeId}:quote`, 'default');
}

export async function createManifestAction(input: {
  name: string;
  origin?: string;
  dest?: string;
  mode?: 'air' | 'sea';
  pricingMode?: 'cards' | 'fixed';
}) {
  const url = buildApiUrl('/v1/manifests');
  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await safeApiError(r, 'Failed to create manifest'));
  const raw = await r.json();
  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  revalidateTag('manifests', 'default');
  return id;
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
      const msg = extractErrorMessage(json, `Import failed (${r.status})`);
      return { ok: false, error: String(msg).slice(0, 300) };
    }

    if (!dryRun) {
      revalidateTag(`manifest:${safeId}`, 'default');
    }

    const ImportResultSchema = z.object({
      mode: z.enum(['append', 'replace']),
      dryRun: z.boolean(),
      valid: z.number().int(),
      invalid: z.number().int(),
      inserted: z.number().int(),
      replaced: z.number().int().optional(),
      errors: z.array(z.object({ line: z.number().int(), message: z.string() })),
    });
    return { ok: true, result: ImportResultSchema.parse(json) };
  } catch (e: unknown) {
    return { ok: false, error: formatError(e, 'Import failed') };
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
  quantity?: string | number | null; // optional shipment quantity context
  liters?: string | number | null; // optional liters context
  dimsCm?: { l?: number; w?: number; h?: number } | null;
};

/**
 * Replace all items with the provided list.
 * Accepts any array-ish of items (from /full), picks only schema fields, and optionally dry-runs.
 */
export async function replaceItemsAction(
  id: string,
  itemsRaw: unknown[],
  dryRun = false
): Promise<{ ok: true; replaced: number } | { ok: false; error: string }> {
  try {
    const safeId = assertId(id, 'manifest id');

    const items: ManifestItemInput[] = (itemsRaw ?? []).map((raw) => {
      const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const dimsRaw = it.dimsCm;
      const dims =
        dimsRaw && typeof dimsRaw === 'object' ? (dimsRaw as Record<string, unknown>) : {};

      const ref = it.reference;
      const notes = it.notes;
      const hs6 = it.hs6;
      const categoryKey = it.categoryKey;
      const itemValueAmount = it.itemValueAmount;
      const itemValueCurrency = it.itemValueCurrency;
      const weightKg = it.weightKg;
      const quantity = it.quantity;
      const liters = it.liters;

      return {
        reference: ref == null ? null : String(ref),
        notes: notes == null ? null : String(notes),
        hs6: hs6 == null ? null : String(hs6),
        categoryKey: categoryKey == null ? null : String(categoryKey),
        itemValueAmount:
          typeof itemValueAmount === 'number' || typeof itemValueAmount === 'string'
            ? itemValueAmount
            : '0',
        itemValueCurrency: typeof itemValueCurrency === 'string' ? itemValueCurrency : 'USD',
        weightKg: typeof weightKg === 'number' || typeof weightKg === 'string' ? weightKg : '0',
        quantity: typeof quantity === 'number' || typeof quantity === 'string' ? quantity : null,
        liters: typeof liters === 'number' || typeof liters === 'string' ? liters : null,
        dimsCm: {
          l: Number(dims.l ?? 0) || 0,
          w: Number(dims.w ?? 0) || 0,
          h: Number(dims.h ?? 0) || 0,
        },
      };
    });

    const url = buildApiUrl(`/v1/manifests/${encodeURIComponent(safeId)}/items:replace`);
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ items, dryRun }),
      cache: 'no-store',
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = extractErrorMessage(json, `Replace failed (${r.status})`);
      return { ok: false, error: String(msg).slice(0, 300) };
    }

    if (!dryRun) {
      revalidateTag(`manifest:${safeId}`, 'default');
    }
    const ReplaceResultSchema = z.object({
      replaced: z.number().int().optional(),
    });
    const parsed = ReplaceResultSchema.parse(json);
    return { ok: true, replaced: parsed.replaced ?? items.length };
  } catch (e: unknown) {
    return { ok: false, error: formatError(e, 'Replace failed') };
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
  const raw = await r.json();
  const j = z.object({ id: z.string().uuid() }).parse(raw);
  revalidateTag('manifests', 'default');
  return j.id;
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
  revalidateTag('manifests', 'default');
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
  revalidateTag(`manifest:${safeId}`, 'default');
  revalidateTag('manifests', 'default');
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
    quantity: string | number | null;
    liters: string | number | null;
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
  revalidateTag(`manifest:${safeManifestId}`, 'default');
  revalidateTag(`manifest:${safeManifestId}:quote`, 'default');
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
  revalidateTag(`manifest:${safeManifestId}`, 'default');
  revalidateTag(`manifest:${safeManifestId}:quote`, 'default');
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
  revalidateTag(`manifest:${safeId}`, 'default');
  revalidateTag('manifests', 'default');
}
