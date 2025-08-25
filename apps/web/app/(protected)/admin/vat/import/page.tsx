import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ImportVat() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Import VAT (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste CSV with headers: <code>dest,ratePct,base,effectiveFrom,effectiveTo,notes</code>
          </p>
          <form action="/api/admin/vat/import" method="post" className="space-y-3">
            <textarea
              name="csv"
              rows={12}
              className="w-full border rounded-md p-3 font-mono text-sm"
              required
            />
            <div className="flex gap-2">
              <Button type="submit">Import</Button>
              <Button asChild variant="secondary">
                <Link href="/apps/web/app/(protected)/admin/vat">Back</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
