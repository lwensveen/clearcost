import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ImportFreight() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Freight (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste an array of cards:{' '}
            <code>{`[{ origin, dest, mode, unit, effectiveFrom, steps: [ { uptoQty, pricePerUnit } ] }]`}</code>
          </p>
          <form action="/api/admin/freight/import" method="post" className="space-y-3">
            <textarea
              name="json"
              rows={14}
              className="w-full border rounded-md p-3 font-mono text-sm"
              required
            />
            <div className="flex gap-2">
              <Button type="submit">Import</Button>
              <Button asChild variant="secondary">
                <Link href="/admin/freight">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
