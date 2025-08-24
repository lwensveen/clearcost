import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function NewKeyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ownerId =
    typeof sp.ownerId === 'string'
      ? sp.ownerId
      : Array.isArray(sp.ownerId)
        ? (sp.ownerId[0] ?? '')
        : '';

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/api-keys/create" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner ID</Label>
              <Input id="ownerId" name="ownerId" required defaultValue={ownerId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="My Storefront" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scopes">Scopes (comma separated)</Label>
              <Input
                id="scopes"
                name="scopes"
                placeholder="quotes:write,quotes:read,classify:write,hs:read"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button asChild variant="secondary">
                <Link href={`/admin/api-keys?ownerId=${ownerId}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
