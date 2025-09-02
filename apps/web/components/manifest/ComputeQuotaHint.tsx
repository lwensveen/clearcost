'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PlanResp = {
  plan: string;
  status?: string | null;
  computeLimitPerDay?: number | null;
  computeUsedToday?: number | null;
};

export function ComputeQuotaHint() {
  const [data, setData] = useState<PlanResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch('/api/cc/billing/plan', { cache: 'no-store' });
        if (!r.ok) throw new Error(await r.text());
        const j: PlanResp = await r.json();
        if (!cancel) {
          setData(j);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load plan');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (!data || err) {
    return <span className="text-xs text-neutral-500"> </span>;
  }

  const limit = data.computeLimitPerDay ?? null;
  const used = data.computeUsedToday ?? null;
  const hasQuota = limit != null && used != null;

  let cls = 'text-neutral-500';
  if (hasQuota) {
    if (used >= limit) cls = 'text-red-600';
    else if (limit - used <= 3) cls = 'text-amber-600';
  }

  return (
    <span className={`text-xs ${cls}`}>
      {hasQuota ? (
        <>
          daily compute {used}/{limit}
          {used >= (limit ?? 0) && (
            <>
              {' '}
              •{' '}
              <Link href="/admin/billing" className="underline">
                upgrade
              </Link>
            </>
          )}
        </>
      ) : (
        <>plan: {data.plan ?? '—'}</>
      )}
    </span>
  );
}
