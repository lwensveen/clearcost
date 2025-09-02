'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createCheckout, openPortal } from './actions';

export function BillingButtons() {
  const [pending, start] = useTransition();

  const go = (fn: () => Promise<string>, label: string) =>
    start(async () => {
      try {
        toast.loading(label);
        const url = await fn();
        window.location.href = url;
      } catch (e: any) {
        toast.error('Billing action failed', { description: e?.message });
      } finally {
        toast.dismiss(); // clear the loading toast
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() => go(() => createCheckout('starter'), 'Opening Starter…')}
      >
        Start Starter
      </Button>
      <Button
        disabled={pending}
        onClick={() => go(() => createCheckout('growth'), 'Opening Growth…')}
      >
        Start Growth
      </Button>
      <Button
        disabled={pending}
        onClick={() => go(() => createCheckout('scale'), 'Opening Scale…')}
      >
        Start Scale
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => go(() => openPortal(), 'Opening portal…')}
      >
        Manage Billing
      </Button>
    </div>
  );
}
