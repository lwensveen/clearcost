'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { computeAction } from '../../app/(protected)/admin/manifests/[id]/actions';
import { getDailyComputeLimit, todayKey } from '@/lib/plan';

export function ComputeButton({ id, plan }: { id: string; plan?: string }) {
  const [pending, start] = useTransition();
  const [used, setUsed] = useState<number>(0);

  const limit = getDailyComputeLimit(plan);
  const LS_KEY = `cc:computeUsed:${todayKey()}`;

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(LS_KEY) ?? '0');
      setUsed(Number.isFinite(n) ? n : 0);
    } catch {
      // ignore
    }
  }, [LS_KEY]);

  const bumpUsed = () => {
    try {
      const n = Number(localStorage.getItem(LS_KEY) ?? '0');
      const next = (Number.isFinite(n) ? n : 0) + 1;
      localStorage.setItem(LS_KEY, String(next));
      setUsed(next);
    } catch {
      // ignore
    }
  };

  const onClick = () =>
    start(async () => {
      try {
        await computeAction(id);
        bumpUsed();
        toast.success('Computed');
      } catch (e: any) {
        toast.error('Compute failed', { description: e?.message });
      }
    });

  return (
    <div className="flex items-center gap-3">
      <Button disabled={pending} onClick={onClick}>
        {pending ? 'Computing…' : 'Compute'}
      </Button>
      <div className="text-xs text-neutral-600">
        Daily compute {used} / {limit}
        <span className="mx-2">·</span>
        <Link href="/admin/billing" className="underline">
          Manage plan
        </Link>
      </div>
    </div>
  );
}
