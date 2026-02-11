import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewCard() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>New Freight Card</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/freight/cards/create" method="post" className="space-y-4">
            <div className="space-y-2">
              <Label>Origin (3)</Label>
              <Input name="origin" required placeholder="LAX" />
            </div>
            <div className="space-y-2">
              <Label>Dest (3)</Label>
              <Input name="dest" required placeholder="HKG" />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <select name="mode" className="w-full border rounded-md h-10 px-3">
                <option value="air">air</option>
                <option value="sea">sea</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <select name="unit" className="w-full border rounded-md h-10 px-3">
                <option value="kg">kg</option>
                <option value="m3">m3</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Currency (ISO-4217)</Label>
              <Input name="currency" required defaultValue="USD" placeholder="USD" />
            </div>
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input name="carrier" />
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Input name="service" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" />
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input name="effectiveFrom" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Effective To</Label>
              <Input name="effectiveTo" type="date" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button asChild variant="secondary">
                <Link href="/admin/freight">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
