'use server';

import { revalidateTag } from 'next/cache';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

// Small helper: always send the server key; merge any extras (e.g., content-type)
function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { 'x-api-key': KEY, ...extra };
}

export async function computeAction(
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight' = 'chargeable'
) {
  const r = await fetch(`${API}/v1/manifests/${id}/compute`, {
    method: 'POST',
    headers: {
      ...authHeaders({ 'content-type': 'application/json' }),
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ allocation, dryRun: false }),
    cache: 'no-store',
  });

  if (!r.ok) {
    // Try JSON error first, fall back to text
    let msg = '';
    try {
      const j = await r.json();
      msg = j?.error || j?.message || '';
    } catch {
      msg = await r.text().catch(() => '');
    }
    if (r.status === 402) throw new Error(msg || 'Plan limit exceeded');
    throw new Error(msg || `Compute failed (${r.status})`);
  }

  revalidateTag(`manifest:${id}`);
  revalidateTag(`manifest:${id}:quote`);
}

export async function createManifestAction(input: {
  name: string;
  origin?: string;
  dest?: string;
  mode?: 'air' | 'sea' | string;
  pricingMode?: 'chargeable' | 'volumetric' | 'weight' | string;
}) {
  const r = await fetch(`${API}/v1/manifests`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await r.text().catch(() => 'Failed to create manifest'));
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
    const mode = (formData.get('mode') as 'append' | 'replace') ?? 'append';
    const dryRun = formData.get('dryRun') === 'on';

    const csv = await file.text();

    const r = await fetch(
      `${API}/v1/manifests/${id}/items:import-csv?mode=${mode}&dryRun=${dryRun ? 'true' : 'false'}`,
      {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'text/csv' }),
        body: csv,
        cache: 'no-store',
      }
    );

    const json = await r.json().catch(() => ({}) as any);
    if (!r.ok) {
      const msg = (json && (json.error || json.message)) || `Import failed (${r.status})`;
      return { ok: false, error: msg };
    }

    // On non-dry runs, refresh manifest + items views
    if (!dryRun) {
      revalidateTag(`manifest:${id}`);
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

    const r = await fetch(`${API}/v1/manifests/${id}/items:replace`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ items, dryRun }),
      cache: 'no-store',
    });

    const json = await r.json().catch(() => ({}) as any);
    if (!r.ok) {
      const msg = (json && (json.error || json.message)) || `Replace failed (${r.status})`;
      return { ok: false, error: msg };
    }

    if (!dryRun) {
      revalidateTag(`manifest:${id}`);
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
