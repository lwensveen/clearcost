import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ImportSurcharges() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Surcharges (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Headers: <code>dest,code,fixedAmt,pctAmt,effectiveFrom,effectiveTo,notes</code>
          </p>
          <form action="/api/admin/surcharges/import" method="post" className="space-y-3">
            <textarea
              name="csv"
              rows={12}
              className="w-full border rounded-md p-3 font-mono text-sm"
              required
            />
            <div className="flex gap-2">
              <Button type="submit">Import</Button>
              <Button asChild variant="secondary">
                <Link href="/admin/surcharges">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
