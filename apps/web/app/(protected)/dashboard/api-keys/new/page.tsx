import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function NewKeyPage() {
  const session = await auth();
  const ownerId = session?.user?.id as string | undefined;
  if (!ownerId) return <div className="text-sm text-muted-foreground">Sign in to continue.</div>;

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/me/api-keys/create" method="post" className="space-y-4">
            <input type="hidden" name="ownerId" value={ownerId} />
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                className="w-full rounded-md border bg-background p-2"
                name="name"
                required
                placeholder="My Storefront"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Scopes (comma separated)</label>
              <input
                className="w-full rounded-md border bg-background p-2"
                name="scopes"
                placeholder="quotes:write,quotes:read,classify:write,hs:read"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/api-keys">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
