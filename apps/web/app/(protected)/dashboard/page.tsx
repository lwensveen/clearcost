import Link from 'next/link';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
import { StatCard } from '@/components/ui/stat-card';
import type { RecentQuoteRow } from '@/lib/quotes';

async function getRecentQuotes(): Promise<{ rows: RecentQuoteRow[] }> {
  return { rows: [] };
}
async function getUsageSummary() {
  return { last24h: 0, last7d: 0 };
}

export default async function DashboardHome() {
  const [recent, usage] = await Promise.all([getRecentQuotes(), getUsageSummary()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Quick start & recent activity."
        actions={
          <>
            <LinkButton href="/dashboard/quotes/new" variant="outline">
              New quote
            </LinkButton>
            <LinkButton href="/dashboard/manifests/new">New manifest</LinkButton>
          </>
        }
      />

      <Section>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Requests (24h)" value={usage.last24h} />
          <StatCard label="Requests (7d)" value={usage.last7d} />
          <StatCard
            label="Docs"
            value="API reference"
            right={
              <Link href="/docs" className="text-xs underline">
                Open
              </Link>
            }
          />
        </div>
      </Section>

      <Section title="Get started">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Step 1</div>
            <div className="mt-2 font-medium">Get an API key</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a scoped key to call the API.
            </p>
            <div className="mt-3">
              <LinkButton href="/dashboard/api-keys" variant="outline">
                Manage keys
              </LinkButton>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Step 2</div>
            <div className="mt-2 font-medium">Make your first quote</div>
            <p className="mt-1 text-sm text-muted-foreground">
              POST <code>/v1/quotes</code>
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/docs" className="text-sm underline">
                Read the docs
              </Link>
              <LinkButton href="/dashboard/quotes/new" variant="outline">
                Try it
              </LinkButton>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Step 3</div>
            <div className="mt-2 font-medium">Bulk via manifests</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload CSV and compute landed cost for many items.
            </p>
            <div className="mt-3">
              <LinkButton href="/dashboard/manifests/new" variant="outline">
                Create manifest
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Recent activity" description="Latest quotes you computed.">
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Lane</th>
                <th className="p-2 text-left">Mode</th>
                <th className="p-2 text-left">HS6</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.rows?.map((r: RecentQuoteRow) => (
                <tr key={r.idemKey} className="border-t">
                  <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-2">
                    {r.origin} → {r.dest}
                  </td>
                  <td className="p-2">{r.mode || '-'}</td>
                  <td className="p-2">{r.hs6 || '-'}</td>
                  <td className="p-2 text-right">
                    {r.currency
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: r.currency,
                        }).format(r.total)
                      : r.total}
                  </td>
                </tr>
              ))}
              {!recent.rows?.length && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={5}>
                    No recent activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
