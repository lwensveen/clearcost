import { fetchManifests } from '@/lib/cc';
import { CreateManifestDialog } from '@/components/manifest/CreateManifestDialog';

export const revalidate = 0;

export default async function ManifestsPage() {
  const { items } = await fetchManifests();
  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manifests</h1>
        <CreateManifestDialog />
      </div>
      <ul className="divide-y border rounded">
        {(items ?? []).map((m) => (
          <li key={m.id} className="p-4 hover:bg-neutral-50">
            <a className="underline" href={`/admin/manifests/${m.id}`}>
              {m.name ?? m.id}
            </a>
          </li>
        ))}
        {(!items || items.length === 0) && (
          <li className="p-4 text-neutral-500">No manifests yet.</li>
        )}
      </ul>
    </main>
  );
}
