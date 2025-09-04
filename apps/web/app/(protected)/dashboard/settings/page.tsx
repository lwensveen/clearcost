import { fetchOrgSettings } from '@/lib/orgs';
import { rotateWebhookSecret, updateOrgSettings, updateProfile } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const revalidate = 0;

export default async function SettingsPage() {
  const { org, settings } = await fetchOrgSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization, billing, and webhooks.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Update org name and defaults.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrgSettings} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Org name</Label>
                <Input id="name" name="name" defaultValue={org.name ?? ''} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="billingEmail">Billing email</Label>
                <Input
                  id="billingEmail"
                  name="billingEmail"
                  defaultValue={settings?.billingEmail ?? ''}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="defaultCurrency">Default currency</Label>
                <Input
                  id="defaultCurrency"
                  name="defaultCurrency"
                  defaultValue={settings?.defaultCurrency ?? 'USD'}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="taxId">Tax ID</Label>
                <Input id="taxId" name="taxId" defaultValue={settings?.taxId ?? ''} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  name="webhookUrl"
                  defaultValue={settings?.webhookUrl ?? ''}
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className="grow">
                  <div className="text-muted-foreground">Webhook secret</div>
                  <code className="break-all">{settings?.webhookSecret ?? '—'}</code>
                </div>
                <Button formAction={rotateWebhookSecret} type="submit" variant="outline">
                  Rotate
                </Button>
              </div>

              <div className="pt-2">
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your display name.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" name="name" placeholder="Your name" />
              </div>
              <Button type="submit" variant="outline">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
