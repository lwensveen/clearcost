import { listSurcharges } from '@/lib/surcharges';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Surcharges</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/surcharges/import">Import</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/surcharges/new">New</Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <SurchargesTable />
      </Suspense>
    </div>
  );
}

async function SurchargesTable() {
  const rows = await listSurcharges({ limit: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dest</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Fixed</TableHead>
              <TableHead className="text-right">Percent</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.dest}</TableCell>
                <TableCell>{r.code}</TableCell>
                <TableCell className="text-right">{r.fixedAmt ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {r.pctAmt ?? '—'}
                  {r.pctAmt ? ' %' : ''}
                </TableCell>
                <TableCell>{new Date(r.effectiveFrom).toLocaleDateString()}</TableCell>
                <TableCell>
                  {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">{r.notes ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <form action={`/api/admin/surcharges/${r.id}/delete`} method="post">
                    <Button size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No rows
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
