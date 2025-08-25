import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewSurcharge() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>New Surcharge</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/surcharges/create" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label>Dest (ISO2)</Label>
              <Input name="dest" required placeholder="US" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input name="code" required placeholder="brokerage, security, etc" />
            </div>
            <div className="space-y-2">
              <Label>Fixed Amount</Label>
              <Input name="fixedAmt" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Percent (%)</Label>
              <Input name="pctAmt" type="number" step="0.001" />
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input name="effectiveFrom" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input name="effectiveTo" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button asChild variant="secondary">
                <Link href="/apps/web/app/(protected)/admin/surcharges">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
