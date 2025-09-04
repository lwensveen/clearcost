'use server';

import { revalidatePath } from 'next/cache';
import {
  cloneManifest as sdkCloneManifest,
  computeManifest as sdkComputeManifest,
  createManifest as sdkCreateManifest,
  deleteManifest as sdkDeleteManifest,
  genIdemKey,
  getManifest as sdkGetManifest,
  getManifestFull as sdkGetManifestFull,
  getManifestQuotes as sdkGetManifestQuotes,
  getManifestQuotesHistory as sdkGetManifestQuotesHistory,
  importManifestItemsCsv as sdkImportItemsCsv,
  listManifests as sdkListManifests,
} from '@clearcost/sdk';

// Centralized SDK init so we don’t repeat env reads
function sdk() {
  const baseUrl = process.env.CLEARCOST_API_URL!;
  const apiKey = process.env.CLEARCOST_WEB_SERVER_KEY!;
  if (!baseUrl || !apiKey) {
    throw new Error('Missing CLEARCOST_API_URL / CLEARCOST_WEB_SERVER_KEY');
  }
  return { baseUrl, apiKey };
}

export async function listManifests(): Promise<Awaited<ReturnType<typeof sdkListManifests>>> {
  return sdkListManifests(sdk());
}

export async function createManifest(
  form: FormData
): Promise<Awaited<ReturnType<typeof sdkCreateManifest>>> {
  // Create a shell; items are added later via CSV or editor
  const body = {
    name: String(form.get('name') || 'Untitled'),
    mode: (String(form.get('shippingMode') || 'air') as 'air' | 'sea') ?? 'air',
    items: [] as any[],
  };

  const out = await sdkCreateManifest(sdk(), body);
  revalidatePath('/(protected)/dashboard/manifests');
  return out;
}

export async function getManifest(id: string): Promise<Awaited<ReturnType<typeof sdkGetManifest>>> {
  return sdkGetManifest(sdk(), id);
}

export async function getManifestFull(
  id: string
): Promise<Awaited<ReturnType<typeof sdkGetManifestFull>>> {
  return sdkGetManifestFull(sdk(), id);
}

// SDK doesn’t export an exportItemsCsv helper yet; use a tiny local fallback.
export async function exportItemsCsv(id: string): Promise<string> {
  const { baseUrl, apiKey } = sdk();
  const res = await fetch(`${baseUrl}/v1/manifests/${encodeURIComponent(id)}/items.csv`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.text();
}

export async function importItemsCsv(
  id: string,
  csv: string,
  mode: 'append' | 'replace',
  dryRun = false
): Promise<Awaited<ReturnType<typeof sdkImportItemsCsv>>> {
  return sdkImportItemsCsv(sdk(), id, csv, { mode, dryRun });
}

export async function computeManifest(
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight',
  dryRun = false
): Promise<Awaited<ReturnType<typeof sdkComputeManifest>>> {
  const idem = await genIdemKey();
  return sdkComputeManifest(sdk(), id, allocation, {
    idempotencyKey: idem,
    dryRun,
  });
}

export async function getLatestQuote(
  id: string
): Promise<Awaited<ReturnType<typeof sdkGetManifestQuotes>>> {
  return sdkGetManifestQuotes(sdk(), id);
}

export async function getHistory(
  id: string
): Promise<Awaited<ReturnType<typeof sdkGetManifestQuotesHistory>>> {
  return sdkGetManifestQuotesHistory(sdk(), id);
}

export async function cloneManifest(
  id: string,
  name?: string
): Promise<Awaited<ReturnType<typeof sdkCloneManifest>>> {
  const res = await sdkCloneManifest(sdk(), id, name);
  revalidatePath('/(protected)/dashboard/manifests');
  return res;
}

export async function deleteManifest(
  id: string
): Promise<Awaited<ReturnType<typeof sdkDeleteManifest>>> {
  const res = await sdkDeleteManifest(sdk(), id);
  revalidatePath('/(protected)/dashboard/manifests');
  return res;
}
