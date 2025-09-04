import { listVAT } from '@/lib/vat';
import { Suspense } from 'react';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';

export default async function Page() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">VAT Rules</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/vat/import">Import CSV</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/vat/new">New</Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <VatTable />
      </Suspense>
    </div>
  );
}

async function VatTable() {
  const rows = await listVAT({ limit: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest rules</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dest</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Effective To</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.dest}</TableCell>
                <TableCell>{Number(r.ratePct).toFixed(2)}%</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.base}</Badge>
                </TableCell>
                <TableCell>{new Date(r.effectiveFrom).toLocaleDateString()}</TableCell>
                <TableCell>
                  {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">{r.notes ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <form action={`/api/admin/vat/${r.id}/delete`} method="post">
                    <Button size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No rules
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
