'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { deleteItemAction, updateItemAction } from '@/app/(protected)/admin/manifests/[id]/actions';
import { formatError } from '@/lib/errors';

type Item = {
  id: string;
  reference: string | null;
  hs6: string | null;
  itemValueAmount: string | number;
  itemValueCurrency: string;
  weightKg: string | number;
  notes: string | null;
};

export function InlineItemsTable({ manifestId, items }: { manifestId: string; items: Item[] }) {
  const [rows, setRows] = useState<Item[]>(items);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();

  const onEdit = (id: string, on: boolean) => setEditing((m) => ({ ...m, [id]: on }));

  const onField = <K extends keyof Item>(id: string, key: K, value: Item[K]) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const currencyChoices = useMemo(() => {
    const s = new Set(rows.map((r) => (r.itemValueCurrency || '').toUpperCase()).filter(Boolean));
    return Array.from(s);
  }, [rows]);

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <th className="text-left p-2 border-r">Reference</th>
            <th className="text-left p-2 border-r">HS6</th>
            <th className="text-right p-2 border-r">Value</th>
            <th className="text-left p-2 border-r">Curr</th>
            <th className="text-right p-2 border-r">Weight (kg)</th>
            <th className="text-left p-2">Notes</th>
            <th className="p-2 w-40">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isEditing = !!editing[r.id];
            return (
              <tr key={r.id} className="odd:bg-white even:bg-neutral-50 align-top">
                <td className="p-2 border-r">
                  {isEditing ? (
                    <Input
                      value={r.reference ?? ''}
                      onChange={(e) => onField(r.id, 'reference', e.target.value || null)}
                    />
                  ) : (
                    (r.reference ?? '')
                  )}
                </td>
                <td className="p-2 border-r">
                  {isEditing ? (
                    <Input
                      value={r.hs6 ?? ''}
                      onChange={(e) => onField(r.id, 'hs6', e.target.value || null)}
                      placeholder="6 digits"
                    />
                  ) : (
                    (r.hs6 ?? '')
                  )}
                </td>
                <td className="p-2 border-r text-right">
                  {isEditing ? (
                    <Input
                      inputMode="decimal"
                      value={String(r.itemValueAmount ?? '')}
                      onChange={(e) => onField(r.id, 'itemValueAmount', e.target.value)}
                    />
                  ) : (
                    r.itemValueAmount
                  )}
                </td>
                <td className="p-2 border-r">
                  {isEditing ? (
                    <Input
                      list={`curr-${r.id}`}
                      value={r.itemValueCurrency ?? ''}
                      onChange={(e) =>
                        onField(r.id, 'itemValueCurrency', e.target.value.toUpperCase())
                      }
                      placeholder="USD"
                    />
                  ) : (
                    r.itemValueCurrency
                  )}
                  {isEditing && (
                    <datalist id={`curr-${r.id}`}>
                      {currencyChoices.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  )}
                </td>
                <td className="p-2 border-r text-right">
                  {isEditing ? (
                    <Input
                      inputMode="decimal"
                      value={String(r.weightKg ?? '')}
                      onChange={(e) => onField(r.id, 'weightKg', e.target.value)}
                    />
                  ) : (
                    r.weightKg
                  )}
                </td>
                <td className="p-2">
                  {isEditing ? (
                    <Textarea
                      value={r.notes ?? ''}
                      onChange={(e) => onField(r.id, 'notes', e.target.value || null)}
                      rows={1}
                    />
                  ) : (
                    (r.notes ?? '')
                  )}
                </td>
                <td className="p-2">
                  {isEditing ? (
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          // revert row to original snapshot from items prop
                          const orig = items.find((i) => i.id === r.id);
                          if (orig) {
                            setRows((rs) => rs.map((x) => (x.id === r.id ? { ...orig } : x)));
                          }
                          onEdit(r.id, false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          start(async () => {
                            try {
                              await updateItemAction(manifestId, r.id, {
                                reference: r.reference ?? null,
                                notes: r.notes ?? null,
                                hs6: r.hs6 ?? null,
                                itemValueAmount: r.itemValueAmount,
                                itemValueCurrency: r.itemValueCurrency,
                                weightKg: r.weightKg,
                              });
                              toast.success('Item saved');
                              onEdit(r.id, false);
                            } catch (e: unknown) {
                              toast.error('Save failed', {
                                description: formatError(e, 'Save failed'),
                              });
                            }
                          })
                        }
                        disabled={pending}
                      >
                        {pending ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => onEdit(r.id, true)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          start(async () => {
                            const prev = rows;
                            // optimistic remove
                            setRows((rs) => rs.filter((x) => x.id !== r.id));
                            try {
                              await deleteItemAction(manifestId, r.id);
                              toast.success('Item deleted');
                            } catch (e: unknown) {
                              setRows(prev);
                              toast.error('Delete failed', {
                                description: formatError(e, 'Delete failed'),
                              });
                            }
                          })
                        }
                        disabled={pending}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="p-4 text-sm text-neutral-500">
                No items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
