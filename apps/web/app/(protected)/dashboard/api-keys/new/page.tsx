'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewKeyPage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/me/api-keys/create', { method: 'POST', body: form });
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
      <div className="max-w-xl">
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
              <Link href="/dashboard/api-keys">Back to keys</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
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
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create'}
              </Button>
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
