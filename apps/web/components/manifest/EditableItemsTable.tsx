'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { replaceItemsAction } from '../../app/(protected)/admin/manifests/[id]/actions';

type ItemRow = {
  id?: string;
  reference?: string | null;
  notes?: string | null;
  hs6?: string | null;
  categoryKey?: string | null;
  itemValueAmount: string | number;
  itemValueCurrency: string;
  weightKg?: string | number;
  dimsCm?: { l?: number; w?: number; h?: number } | null;
};

function normalizeItem(it: any): ItemRow {
  const d = it?.dimsCm ?? it?.dims ?? {};
  return {
    id: it.id,
    reference: it.reference ?? '',
    notes: it.notes ?? '',
    hs6: it.hs6 ?? '',
    categoryKey: it.categoryKey ?? '',
    itemValueAmount: it.itemValueAmount ?? '0',
    itemValueCurrency: it.itemValueCurrency ?? 'USD',
    weightKg: it.weightKg ?? '0',
    dimsCm: { l: Number(d.l ?? 0), w: Number(d.w ?? 0), h: Number(d.h ?? 0) },
  };
}

export function EditableItemsTable({ id, items: initial }: { id: string; items: any[] }) {
  const [rows, setRows] = useState<ItemRow[]>(() => (initial ?? []).map(normalizeItem));
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (i: number, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        itemValueAmount: '0',
        itemValueCurrency: 'USD',
        weightKg: '0',
        dimsCm: { l: 0, w: 0, h: 0 },
      },
    ]);

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const submit = (dryRun: boolean) =>
    start(async () => {
      const p = replaceItemsAction(id, rows, dryRun);
      await toast.promise(p, {
        loading: dryRun ? 'Validating…' : 'Saving…',
        success: dryRun ? 'Dry run OK' : 'Items saved',
        error: 'Save failed',
      });
      const res = await p;
      if (!res.ok) throw new Error(res.error);
      if (!dryRun) router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Items (inline edit)</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => submit(true)} disabled={pending}>
            {pending ? 'Checking…' : 'Dry run'}
          </Button>
          <Button onClick={() => submit(false)} disabled={pending}>
            {pending ? 'Saving…' : 'Save all'}
          </Button>
          <Button variant="secondary" onClick={addRow}>
            Add row
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 text-left">Ref</th>
              <th className="p-2 text-left">HS6</th>
              <th className="p-2 text-left">Cat</th>
              <th className="p-2 text-right">Value</th>
              <th className="p-2 text-left">Curr</th>
              <th className="p-2 text-right">Weight kg</th>
              <th className="p-2 text-right">L</th>
              <th className="p-2 text-right">W</th>
              <th className="p-2 text-right">H</th>
              <th className="p-2 text-left">Notes</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-neutral-50 align-top">
                <td className="p-2">
                  <Input
                    value={r.reference ?? ''}
                    onChange={(e) => set(i, { reference: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <Input value={r.hs6 ?? ''} onChange={(e) => set(i, { hs6: e.target.value })} />
                </td>
                <td className="p-2">
                  <Input
                    value={r.categoryKey ?? ''}
                    onChange={(e) => set(i, { categoryKey: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="decimal"
                    value={String(r.itemValueAmount ?? '')}
                    onChange={(e) => set(i, { itemValueAmount: e.target.value })}
                    className="text-right"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={r.itemValueCurrency ?? 'USD'}
                    onChange={(e) => set(i, { itemValueCurrency: e.target.value.toUpperCase() })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="decimal"
                    value={String(r.weightKg ?? '')}
                    onChange={(e) => set(i, { weightKg: e.target.value })}
                    className="text-right"
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="numeric"
                    value={String(r.dimsCm?.l ?? 0)}
                    onChange={(e) =>
                      set(i, { dimsCm: { ...(r.dimsCm ?? {}), l: Number(e.target.value || 0) } })
                    }
                    className="text-right"
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="numeric"
                    value={String(r.dimsCm?.w ?? 0)}
                    onChange={(e) =>
                      set(i, { dimsCm: { ...(r.dimsCm ?? {}), w: Number(e.target.value || 0) } })
                    }
                    className="text-right"
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="numeric"
                    value={String(r.dimsCm?.h ?? 0)}
                    onChange={(e) =>
                      set(i, { dimsCm: { ...(r.dimsCm ?? {}), h: Number(e.target.value || 0) } })
                    }
                    className="text-right"
                  />
                </td>
                <td className="p-2 min-w-[200px]">
                  <Textarea
                    value={r.notes ?? ''}
                    onChange={(e) => set(i, { notes: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <Button variant="ghost" onClick={() => removeRow(i)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={11}>
                  No items. Click “Add row”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
