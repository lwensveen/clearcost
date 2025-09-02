'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { computeAction } from '@/app/(protected)/admin/manifests/[id]/actions';

type PlanResp = {
  plan: string;
  status?: string | null;
  computeLimitPerDay?: number | null;
  computeUsedToday?: number | null;
};

export function ComputeButton({ id, plan }: { id: string; plan?: string | null }) {
  const [pending, start] = useTransition();
  const [p, setPlan] = useState<string | null>(plan ?? null);
  const [limit, setLimit] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/cc/billing/plan', { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        const j: PlanResp = await r.json();
        if (cancel) return;
        setPlan(j.plan ?? null);
        setLimit(typeof j.computeLimitPerDay === 'number' ? j.computeLimitPerDay : null);
        setUsed(typeof j.computeUsedToday === 'number' ? j.computeUsedToday : null);
        setErr(null);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load plan');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const disabledReason = useMemo(() => {
    if (err) return `Plan check failed`;
    if (limit != null && used != null) {
      if (used >= limit) return `Daily compute limit reached (${used}/${limit})`;
      if (limit - used === 1) return `Almost out (${used}/${limit})`;
    }
    return null;
  }, [limit, used, err]);

  const disabled = !!disabledReason || pending;

  return (
    <Button
      disabled={disabled}
      title={disabledReason ?? undefined}
      onClick={() =>
        start(async () => {
          try {
            await computeAction(id, 'chargeable');
            toast.success('Compute started', {
              description:
                used != null && limit != null
                  ? `Count: ${Math.min(used + 1, limit)}/${limit}`
                  : undefined,
            });
          } catch (e: any) {
            const msg = e?.message || 'Compute failed';
            toast.error('Compute failed', { description: msg });
          }
        })
      }
    >
      {pending ? 'Computing…' : 'Compute'}
    </Button>
  );
}
