import { getSteps } from '@/lib/freight';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function StepsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const steps = await getSteps(id);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Card {id} — Steps</h1>
        <Button asChild variant="secondary">
          <Link href="/admin/freight">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Step</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={`/api/admin/freight/cards/${id}/steps/create`}
            method="post"
            className="grid md:grid-cols-3 gap-4"
          >
            <div className="space-y-2">
              <Label>Up to Qty</Label>
              <Input name="uptoQty" type="number" step="0.001" required />
            </div>
            <div className="space-y-2">
              <Label>Price / Unit</Label>
              <Input name="pricePerUnit" type="number" step="0.0001" required />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Up to</TableHead>
                <TableHead>Price / Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.uptoQty}</TableCell>
                  <TableCell>{s.pricePerUnit}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <form
                        action={`/api/admin/freight/cards/${id}/steps/${s.id}/update`}
                        method="post"
                        className="flex gap-2"
                      >
                        <input type="hidden" name="cardId" value={id} />
                        <Input
                          name="uptoQty"
                          type="number"
                          step="0.001"
                          placeholder="new upto"
                          className="h-8 w-28"
                        />
                        <Input
                          name="pricePerUnit"
                          type="number"
                          step="0.0001"
                          placeholder="new price"
                          className="h-8 w-28"
                        />
                        <Button size="sm" type="submit">
                          Update
                        </Button>
                      </form>
                      <form
                        action={`/api/admin/freight/cards/${id}/steps/${s.id}/delete`}
                        method="post"
                      >
                        <Button size="sm" variant="destructive">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!steps.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No steps
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
