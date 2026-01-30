'use server';

import { revalidatePath } from 'next/cache';
import { headers as nextHeaders } from 'next/headers';
import { z } from 'zod';
import { getAuth } from '@/auth';
import {
  fetchOrgSettings,
  rotateOrgWebhook,
  updateOrgSettings as apiUpdateOrgSettings,
} from '@/lib/orgs';

const OrgSettingsFormSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  billingEmail: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  defaultCurrency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase()),
  taxId: z
    .string()
    .max(64)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  webhookUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
});

// Optional helper if some code still calls it directly (not as form action)
export async function getSettings() {
  return fetchOrgSettings();
}

export async function updateOrgSettings(formData: FormData): Promise<void> {
  const parsed = OrgSettingsFormSchema.safeParse({
    name: formData.get('name'),
    billingEmail: formData.get('billingEmail'),
    defaultCurrency: formData.get('defaultCurrency'),
    taxId: formData.get('taxId'),
    webhookUrl: formData.get('webhookUrl'),
  });
  if (!parsed.success) {
    // make it a form-action-friendly failure (no non-void return)
    throw new Error(parsed.error.message);
  }

  await apiUpdateOrgSettings(parsed.data);
  revalidatePath('/dashboard/settings');
}

export async function rotateWebhookSecret(): Promise<void> {
  await rotateOrgWebhook();
  revalidatePath('/dashboard/settings');
}

const ProfileSchema = z.object({ name: z.string().min(1) });

export async function updateProfile(formData: FormData): Promise<void> {
  const parsed = ProfileSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  const auth = getAuth();
  if (typeof auth.api.updateUser === 'function') {
    await auth.api.updateUser({
      headers: await nextHeaders(),
      body: { name: parsed.data.name },
    });
  }

  revalidatePath('/dashboard/settings');
}
