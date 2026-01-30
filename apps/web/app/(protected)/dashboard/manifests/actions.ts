'use server';

import { revalidatePath } from 'next/cache';
import {
  cloneManifest,
  computeManifest,
  createManifest,
  deleteManifest,
  importItemsCsv,
} from '@/lib/manifests';
import type { ManifestItemInput } from '@clearcost/types';

export async function createManifestAction(form: FormData): Promise<void> {
  const body = {
    name: String(form.get('name') || 'Untitled'),
    mode: (String(form.get('shippingMode') || 'air') as 'air' | 'sea') ?? 'air',
    items: [] as ManifestItemInput[],
  };
  await createManifest(body);
  revalidatePath('dashboard/manifests');
}

export async function importItemsCsvAction(
  id: string,
  csv: string,
  mode: 'append' | 'replace',
  dryRun = false
): Promise<void> {
  await importItemsCsv(id, csv, { mode, dryRun });
  revalidatePath(`dashboard/manifests/${id}`);
}

export async function computeManifestAction(
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight',
  dryRun = false
): Promise<void> {
  await computeManifest(id, allocation, { dryRun });
  revalidatePath(`dashboard/manifests/${id}`);
}

export async function cloneManifestAction(id: string, name?: string): Promise<void> {
  await cloneManifest(id, name);
  revalidatePath('dashboard/manifests');
}

export async function deleteManifestAction(id: string): Promise<void> {
  await deleteManifest(id);
  revalidatePath('dashboard/manifests');
}
