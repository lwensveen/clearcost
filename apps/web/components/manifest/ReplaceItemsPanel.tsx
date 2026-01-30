'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  clearAllItemsAction,
  replaceItemsAction,
} from '../../app/(protected)/admin/manifests/[id]/actions';
import type { ManifestItemInput } from '../../app/(protected)/admin/manifests/[id]/actions';

type Props = { id: string; items: ManifestItemInput[] };

export function ReplaceItemsPanel({ id, items }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const doDryRun = () =>
    start(async () => {
      setMsg(null);
      const res = await replaceItemsAction(id, items, true);
      if (res.ok) {
        setMsg(`Dry run OK — would replace with ${items.length} items.`);
        toast('Dry run OK', { description: `Would replace with ${items.length} items.` });
      } else {
        toast.error('Replace failed', { description: res.error });
      }
    });

  const doCommit = () =>
    start(async () => {
      setMsg(null);
      const res = await replaceItemsAction(id, items, false);
      if (res.ok) {
        setMsg(`Replaced with ${items.length} items.`);
        toast.success('Items saved');
      } else {
        toast.error('Replace failed', { description: res.error });
      }
    });

  const doClear = () =>
    start(async () => {
      setMsg(null);
      const res = await clearAllItemsAction(id);
      if (res.ok) {
        setMsg('All items cleared.');
        toast.success('All items cleared');
      } else {
        toast.error('Clear failed', { description: res.error });
      }
    });

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Replace all items</h3>
        <div className="text-xs text-neutral-500">{items.length} current items</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1.5 border rounded text-sm"
          disabled={pending}
          onClick={doDryRun}
        >
          {pending ? 'Checking…' : 'Dry run'}
        </button>
        <button
          className="px-3 py-1.5 border rounded text-sm bg-black text-white"
          disabled={pending}
          onClick={doCommit}
        >
          {pending ? 'Replacing…' : 'Replace (commit)'}
        </button>
        <button className="px-3 py-1.5 border rounded text-sm" disabled={pending} onClick={doClear}>
          {pending ? 'Clearing…' : 'Clear all'}
        </button>
      </div>
      {msg && <div className="text-sm text-green-700">{msg}</div>}
      <p className="text-xs text-neutral-500">
        Tip: you can also CSV import with <b>mode=replace</b>.
      </p>
    </div>
  );
}
