'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { patchManifestAction } from '@/app/(protected)/admin/manifests/[id]/actions';
import { formatError } from '@/lib/errors';

export function FixedPricingInline({
  id,
  fixedFreightTotal,
  fixedFreightCurrency,
}: {
  id: string;
  fixedFreightTotal: string | number | null | undefined;
  fixedFreightCurrency: string | null | undefined;
}) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(fixedFreightTotal ?? ''));
  const [ccy, setCcy] = useState(String(fixedFreightCurrency ?? 'USD'));

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <div className="text-xs text-neutral-500">Fixed freight total</div>
        <Input
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000.00"
          disabled={pending}
          className="w-36"
        />
      </div>
      <div className="space-y-1">
        <div className="text-xs text-neutral-500">Currency</div>
        <Input
          value={ccy}
          onChange={(e) => setCcy(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="USD"
          disabled={pending}
          className="w-24"
        />
      </div>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const amt = amount.trim() ? amount.trim() : null;
              const cur = ccy.trim() ? ccy.trim().toUpperCase() : null;
              await patchManifestAction(id, {
                fixedFreightTotal: amt,
                fixedFreightCurrency: cur,
              });
              toast.success('Saved fixed pricing');
            } catch (e: unknown) {
              toast.error('Save failed', {
                description: formatError(e, 'Save failed'),
              });
            }
          })
        }
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
