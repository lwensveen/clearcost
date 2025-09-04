import { db, orgSettingsTable, orgsTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { OrgSettingsCoerced, OrgSettingsSelectCoercedSchema } from '@clearcost/types';

export async function ensureOrgSettings(orgId: string): Promise<OrgSettingsCoerced> {
  let settingsRow = await db.query.orgSettingsTable.findFirst({
    where: (t, { eq: equals }) => equals(t.orgId, orgId),
  });

  if (!settingsRow) {
    await db
      .insert(orgSettingsTable)
      .values({ orgId, defaultCurrency: 'USD' })
      .onConflictDoNothing();
    settingsRow = await db.query.orgSettingsTable.findFirst({
      where: (t, { eq: equals }) => equals(t.orgId, orgId),
    });
    if (!settingsRow) throw new Error('Failed to initialize organization settings');
  }

  return OrgSettingsSelectCoercedSchema.parse(settingsRow);
}

export async function getOrgHeader(orgId: string) {
  const row = await db.query.orgsTable.findFirst({
    where: (t, { eq: equals }) => equals(t.id, orgId),
    columns: { id: true, name: true },
  });
  return row ?? { id: orgId, name: 'Organization' };
}

export async function updateOrgAndSettings(
  orgId: string,
  input: {
    name: string;
    billingEmail?: string | null;
    defaultCurrency: string;
    taxId?: string | null;
    webhookUrl?: string | null;
  }
) {
  await db.update(orgsTable).set({ name: input.name }).where(eq(orgsTable.id, orgId));

  const existing = await db.query.orgSettingsTable.findFirst({
    where: (t, { eq: equals }) => equals(t.orgId, orgId),
    columns: { orgId: true },
  });

  const updatePayload = {
    billingEmail: input.billingEmail ?? null,
    defaultCurrency: input.defaultCurrency,
    taxId: input.taxId ?? null,
    webhookUrl: input.webhookUrl ?? null,
  };

  if (existing) {
    await db.update(orgSettingsTable).set(updatePayload).where(eq(orgSettingsTable.orgId, orgId));
  } else {
    await db.insert(orgSettingsTable).values({ orgId, ...updatePayload });
  }

  return ensureOrgSettings(orgId);
}

export async function rotateOrgWebhookSecret(orgId: string) {
  const secret = randomBytes(16).toString('hex');
  await db
    .update(orgSettingsTable)
    .set({ webhookSecret: secret })
    .where(eq(orgSettingsTable.orgId, orgId));
  return secret;
}
