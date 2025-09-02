import { listKeys } from '@/lib/api-keys';
import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TokenToast } from '@/components/api-keys/token-toast';

export default async function Page({
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

  const token =
    typeof sp.token === 'string' ? sp.token : Array.isArray(sp.token) ? (sp.token[0] ?? '') : '';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {token ? <TokenToast token={token} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid md:grid-cols-3 gap-4" method="get">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ownerId">Owner ID (UUID)</Label>
              <Input id="ownerId" name="ownerId" defaultValue={ownerId} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Load
              </Button>
            </div>
          </form>

          {token && (
            <div className="mt-4 rounded-md border p-3 text-sm">
              <div className="font-medium mb-1">New API Key (copy now):</div>
              <code className="break-all">{token}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {ownerId ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <KeysTable ownerId={ownerId} />
        </Suspense>
      ) : (
        <div className="text-sm text-muted-foreground">Enter an Owner ID to manage keys.</div>
      )}
    </div>
  );
}

async function KeysTable({ ownerId }: { ownerId: string }) {
  const rows = await listKeys(ownerId);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Keys for {ownerId}</CardTitle>
        <Button asChild variant="secondary">
          <Link href={`/admin/api-keys/new?ownerId=${ownerId}`}>Create Key</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  {r.scopes?.length ? (
                    r.scopes.join(', ')
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.isActive ? <Badge>active</Badge> : <Badge variant="secondary">revoked</Badge>}
                </TableCell>
                <TableCell>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</TableCell>
                <TableCell>
                  {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <form
                    action={`/api/admin/api-keys/${r.id}/toggle`}
                    method="post"
                    className="inline"
                  >
                    <input type="hidden" name="ownerId" value={ownerId} />
                    <input type="hidden" name="to" value={r.isActive ? 'false' : 'true'} />
                    <Button
                      type="submit"
                      variant={r.isActive ? 'destructive' : 'default'}
                      size="sm"
                    >
                      {r.isActive ? 'Revoke' : 'Activate'}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  No keys yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
