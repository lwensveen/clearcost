'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { extractErrorMessage, formatError } from '@/lib/errors';

export function RowActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'clone' | 'delete' | null>(null);

  async function onClone() {
    try {
      setBusy('clone');
      const r = await fetch(`/api/cc/manifest/${id}/clone`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractErrorMessage(j, `Clone failed (${r.status})`));
      toast.success('Cloned manifest');
      router.push(`/admin/manifests/${j.id}`);
    } catch (e: unknown) {
      toast.error(formatError(e, 'Clone failed'));
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!confirm('Delete this manifest? This cannot be undone.')) return;
    try {
      setBusy('delete');
      const r = await fetch(`/api/cc/manifest/${id}/delete`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(extractErrorMessage(j, `Delete failed (${r.status})`));
      toast.success('Deleted');
      router.refresh();
    } catch (e: unknown) {
      toast.error(formatError(e, 'Delete failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <a className="px-2 py-1 rounded border text-xs" href={`/api/cc/manifest/${id}/items-csv`}>
        Export
      </a>
      <Button size="sm" variant="secondary" onClick={onClone} disabled={busy !== null}>
        {busy === 'clone' ? 'Cloning…' : 'Clone'}
      </Button>
      <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy !== null}>
        {busy === 'delete' ? 'Deleting…' : 'Delete'}
      </Button>
    </div>
  );
}
