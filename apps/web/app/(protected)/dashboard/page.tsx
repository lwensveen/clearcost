import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function DashboardHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick start & recent activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium">Get an API key</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a scoped key to call the API.
            </p>
            <Button asChild className="mt-3 w-full">
              <Link href="/dashboard/api-keys">Manage keys</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium">Make your first quote</div>
            <p className="mt-1 text-sm text-muted-foreground">
              POST <code className="font-mono">/v1/quotes</code>
            </p>
            <Button asChild variant="secondary" className="mt-3 w-full">
              <Link href="/docs">Read the docs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium">See usage</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Latency and request counts by route.
            </p>
            <Button asChild variant="ghost" className="mt-3 w-full">
              <Link href="/dashboard/usage">Open usage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
