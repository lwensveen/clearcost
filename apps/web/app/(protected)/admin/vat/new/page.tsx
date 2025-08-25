import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function NewVat() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>New VAT Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/vat/create" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label>Destination (ISO2)</Label>
              <Input name="dest" required placeholder="US" />
            </div>
            <div className="space-y-2">
              <Label>Rate %</Label>
              <Input name="ratePct" type="number" step="0.001" min="0" max="100" required />
            </div>
            <div className="space-y-2">
              <Label>Base</Label>
              <select name="base" className="w-full border rounded-md h-10 px-3">
                <option value="CIF_PLUS_DUTY">CIF_PLUS_DUTY</option>
                <option value="CIF">CIF</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input name="effectiveFrom" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Effective To (optional)</Label>
              <Input name="effectiveTo" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button asChild variant="secondary">
                <Link href="/apps/web/app/(protected)/admin/vat">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
