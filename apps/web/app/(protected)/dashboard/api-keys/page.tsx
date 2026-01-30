import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listKeys } from '@/lib/api-keys';
import { getAuth } from '@/auth';
import { headers } from 'next/headers';

export default async function KeysPage() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const ownerId = session?.user?.id as string | undefined;
  if (!ownerId) return <div className="text-sm text-muted-foreground">Sign in to manage keys.</div>;

  const rows = await listKeys(ownerId);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">API keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and revoke your keys.</p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/api-keys/new`}>Create key</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Scopes</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Last used</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.scopes?.join(', ') || '—'}</td>
                    <td className="p-2">{r.isActive ? 'active' : 'revoked'}</td>
                    <td className="p-2">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-2">
                      {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-2 text-right">
                      <form
                        action={`/api/me/api-keys/${r.id}/toggle`}
                        method="post"
                        className="inline"
                      >
                        <input type="hidden" name="to" value={r.isActive ? 'false' : 'true'} />
                        <Button
                          type="submit"
                          variant={r.isActive ? 'destructive' : 'secondary'}
                          size="sm"
                        >
                          {r.isActive ? 'Revoke' : 'Activate'}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="p-2 text-sm text-muted-foreground" colSpan={6}>
                      No keys yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
