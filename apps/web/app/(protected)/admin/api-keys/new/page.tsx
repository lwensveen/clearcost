'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function NewKeyPage() {
  const searchParams = useSearchParams();
  const defaultOwnerId = searchParams.get('ownerId') ?? '';

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/admin/api-keys/create', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to create key (${res.status})`);
        return;
      }
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError('Network error');
    } finally {
      setPending(false);
    }
  }

  if (token) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>API key created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy your key now. It will not be shown again.
            </p>
            <code className="block break-all rounded-md border bg-muted p-3 text-sm">{token}</code>
            <Button asChild variant="secondary">
              <Link href={`/admin/api-keys?ownerId=${encodeURIComponent(defaultOwnerId)}`}>
                Back to keys
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner ID</Label>
              <Input id="ownerId" name="ownerId" required defaultValue={defaultOwnerId} />
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
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating\u2026' : 'Create'}
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/admin/api-keys?ownerId=${encodeURIComponent(defaultOwnerId)}`}>
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
