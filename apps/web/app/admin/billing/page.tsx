import { aggregate, fetchUsageByKey } from '@/lib/clearcost';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const k = 1024,
    sizes = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= k;
    ++i;
  } while (n >= k && i < sizes.length - 1);
  return `${n.toFixed(1)} ${sizes[i]}`;
}

function fmtMs(n: number) {
  return `${Math.round(n)} ms`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const apiKeyId = searchParams.apiKeyId;
  const month = searchParams.month;
  let from = searchParams.from;
  let to = searchParams.to;

  if (month && (!from || !to)) {
    from = `${month}-01`;

    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) {
      to = from;
    } else {
      const yy = Number(m[1]);
      const mm = Number(m[2]);

      const last = new Date(Date.UTC(yy, mm, 0));
      to = last.toISOString().slice(0, 10);
    }
  }

  const show = apiKeyId && from && to;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing / Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid md:grid-cols-4 gap-4" method="get">
            <div className="space-y-2">
              <Label htmlFor="apiKeyId">API Key ID</Label>
              <Input
                id="apiKeyId"
                name="apiKeyId"
                defaultValue={apiKeyId}
                placeholder="uuid-of-api-key"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Input id="month" name="month" type="month" defaultValue={month} />
            </div>
            <div className="space-y-2">
              <Label>Or custom range</Label>
              <div className="flex gap-2">
                <Input name="from" type="date" defaultValue={from} />
                <Input name="to" type="date" defaultValue={to} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full">
                Load
              </Button>
              {show && (
                <Button asChild variant="secondary">
                  <Link href={`/api/admin/usage/export?apiKeyId=${apiKeyId}&from=${from}&to=${to}`}>
                    Export CSV
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {show ? (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading usage…</div>}>
          <UsageSection apiKeyId={apiKeyId!} from={from!} to={to!} />
        </Suspense>
      ) : (
        <div className="text-sm text-muted-foreground px-1">
          Enter an API Key and a month (or date range), then click{' '}
          <span className="font-medium">Load</span>.
        </div>
      )}
    </div>
  );
}

async function UsageSection({
  apiKeyId,
  from,
  to,
}: {
  apiKeyId: string;
  from: string;
  to: string;
}) {
  const rows = await fetchUsageByKey(apiKeyId, from, to);
  const { totalReqs, avgMs, bytesIn, bytesOut, byRoute } = aggregate(rows);

  return (
    <>
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Requests</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalReqs.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtMs(avgMs)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingress</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtBytes(bytesIn)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Egress</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtBytes(bytesOut)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>By Endpoint</CardTitle>
          <Badge variant="secondary">
            {from} → {to}
          </Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Avg ms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byRoute.map((r) => (
                <TableRow key={`${r.route}:${r.method}`}>
                  <TableCell className="font-medium">{r.route}</TableCell>
                  <TableCell>{r.method}</TableCell>
                  <TableCell className="text-right">{r.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtMs(r.sumDurationMs / r.count)}</TableCell>
                </TableRow>
              ))}
              {!byRoute.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
