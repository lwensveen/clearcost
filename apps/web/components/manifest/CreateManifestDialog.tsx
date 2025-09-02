'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createManifestAction } from '@/app/(protected)/admin/manifests/[id]/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateManifestDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [shippingMode, setShippingMode] = useState<'air' | 'sea'>('air');
  const [pricingMode, setPricingMode] = useState<'cards' | 'fixed'>('cards');
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create manifest</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New manifest</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget as HTMLFormElement);

            const name = String(fd.get('name') || '').trim();
            const originRaw = String(fd.get('origin') || '')
              .trim()
              .toUpperCase();
            const destRaw = String(fd.get('dest') || '')
              .trim()
              .toUpperCase();

            if (!name) {
              toast.error('Name is required');
              return;
            }
            if (originRaw && originRaw.length !== 2) {
              toast.error('Origin must be a 2-letter ISO country code');
              return;
            }
            if (destRaw && destRaw.length !== 2) {
              toast.error('Destination must be a 2-letter ISO country code');
              return;
            }

            const origin = originRaw || undefined;
            const dest = destRaw || undefined;

            start(async () => {
              try {
                // Backend expects shippingMode/pricingMode on Manifest;
                // your existing action accepts `mode`, so send both for compatibility.
                const id = await createManifestAction({
                  name,
                  origin,
                  dest,
                  mode: shippingMode, // <-- keeps current action typing happy
                  pricingMode, // 'cards' | 'fixed'
                } as any);

                toast.success('Manifest created');
                setOpen(false);
                router.push(`/admin/manifests/${id}`);
              } catch (err: any) {
                toast.error('Create failed', { description: err?.message });
              }
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 col-span-2">
              <div className="text-xs text-neutral-600">Name</div>
              <Input name="name" placeholder="Spring air pool" required disabled={pending} />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Origin (ISO2)</div>
              <Input name="origin" placeholder="US" disabled={pending} />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Destination (ISO2)</div>
              <Input name="dest" placeholder="GB" disabled={pending} />
            </label>

            <div className="space-y-1">
              <div className="text-xs text-neutral-600">Shipping mode</div>
              <Select
                value={shippingMode}
                onValueChange={(v: any) => setShippingMode(v as 'air' | 'sea')}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="air">air</SelectItem>
                  <SelectItem value="sea">sea</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-neutral-600">Pricing mode</div>
              <Select
                value={pricingMode}
                onValueChange={(v) => setPricingMode(v as 'cards' | 'fixed')}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pricing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cards">cards</SelectItem>
                  <SelectItem value="fixed">fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
