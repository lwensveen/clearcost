import { listCards } from '@/lib/freight';
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
import { Badge } from '@/components/ui/badge';

export default function Page() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Freight Rate Cards</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/freight/import">Import JSON</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/freight/new">New Card</Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <CardsTable />
      </Suspense>
    </div>
  );
}

async function CardsTable() {
  const rows = await listCards({ limit: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origin</TableHead>
              <TableHead>Dest</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.origin}</TableCell>
                <TableCell>{r.dest}</TableCell>
                <TableCell>
                  <Badge>{r.freightMode}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.freightUnit}</Badge>
                </TableCell>
                <TableCell>{r.carrier ?? '—'}</TableCell>
                <TableCell>{r.service ?? '—'}</TableCell>
                <TableCell>{new Date(r.effectiveFrom).toLocaleDateString()}</TableCell>
                <TableCell>
                  {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Link className="underline text-sm" href={`/admin/freight/${r.id}`}>
                      Steps
                    </Link>
                    <form action={`/api/admin/freight/cards/${r.id}/delete`} method="post">
                      <button className="text-sm text-red-600 hover:underline">Delete</button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No cards
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
