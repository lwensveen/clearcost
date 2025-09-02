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

export function CreateManifestDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
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
            const origin =
              String(fd.get('origin') || '')
                .trim()
                .toUpperCase() || undefined;
            const dest =
              String(fd.get('dest') || '')
                .trim()
                .toUpperCase() || undefined;
            const mode = String(fd.get('mode') || '').trim() || undefined;
            const pricingMode = String(fd.get('pricingMode') || '').trim() || undefined;

            if (!name) {
              toast.error('Name is required');
              return;
            }

            start(async () => {
              try {
                const id = await createManifestAction({ name, origin, dest, mode, pricingMode });
                toast.success('Manifest created');
                setOpen(false);
                router.push(`/admin/manifests/${id}`);
              } catch (err: any) {
                toast.error('Create failed', { description: err?.message });
              }
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 col-span-2">
              <div className="text-xs text-neutral-600">Name</div>
              <Input name="name" placeholder="Spring air pool" required />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Origin (ISO2)</div>
              <Input name="origin" placeholder="US" />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Destination (ISO2)</div>
              <Input name="dest" placeholder="GB" />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Mode</div>
              <Input name="mode" placeholder="air" />
            </label>
            <label className="space-y-1">
              <div className="text-xs text-neutral-600">Pricing mode</div>
              <Input name="pricingMode" placeholder="chargeable" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
