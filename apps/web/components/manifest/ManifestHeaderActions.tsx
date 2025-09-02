'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MoreHorizontal } from 'lucide-react';
import {
  cloneManifestAction,
  deleteManifestAction,
  patchManifestAction,
} from '@/app/(protected)/admin/manifests/[id]/actions';

export function ManifestHeaderActions({
  id,
  currentName,
}: {
  id: string;
  currentName?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(currentName ?? '');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState(`${currentName ?? 'Copy'} (clone)`);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Manifest</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>Rename…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCloneOpen(true)}>Clone…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDel(true)}>
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename manifest</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New name"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !newName.trim()}
              onClick={() =>
                start(async () => {
                  try {
                    await patchManifestAction(id, { name: newName.trim() });
                    toast.success('Renamed');
                    setRenameOpen(false);
                  } catch (e: any) {
                    toast.error('Rename failed', { description: e?.message });
                  }
                })
              }
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone manifest</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Name for the clone"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !cloneName.trim()}
              onClick={() =>
                start(async () => {
                  try {
                    const newId = await cloneManifestAction(id, cloneName.trim());
                    toast.success('Cloned');
                    setCloneOpen(false);
                    router.push(`/admin/manifests/${newId}`);
                  } catch (e: any) {
                    toast.error('Clone failed', { description: e?.message });
                  }
                })
              }
            >
              {pending ? 'Cloning…' : 'Clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete manifest?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">
            This will permanently delete the manifest and its items.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await deleteManifestAction(id);
                    toast.success('Deleted');
                    setConfirmDel(false);
                    router.push('/admin/manifests');
                  } catch (e: any) {
                    toast.error('Delete failed', { description: e?.message });
                  }
                })
              }
            >
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
