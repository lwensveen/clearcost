import { listManifests } from './actions';

export default async function ManifestsPage() {
  const data = await listManifests();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold mb-3">Manifests</h1>
        <div className="rounded border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Origin</th>
                <th className="text-left p-2">Dest</th>
                <th className="text-left p-2">Mode</th>
                <th className="text-left p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m.id} className="border-t hover:bg-slate-50">
                  <td className="p-2">
                    <a
                      className="text-blue-600 hover:underline"
                      href={`/dashboard/manifests/${m.id}`}
                    >
                      {m.name ?? m.id}
                    </a>
                  </td>
                  <td className="p-2">{(m as any).origin ?? '—'}</td>
                  <td className="p-2">{(m as any).dest ?? '—'}</td>
                  <td className="p-2">{m.mode ?? '—'}</td>
                  <td className="p-2">
                    {m.createdAt ? new Date(m.createdAt as any).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    No manifests yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.nextCursor && (
          <div className="mt-3 text-sm text-slate-600">
            More available… (nextCursor: <code>{data.nextCursor}</code>)
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Create manifest</h2>
        <form
          action={async (fd) => {
            'use server';
            const { createManifest } = await import('./actions');
            await createManifest(fd);
          }}
          className="grid gap-2 grid-cols-2 max-w-xl"
        >
          <input className="border rounded p-2" name="name" placeholder="Name (e.g. EU Launch)" />
          <input
            className="border rounded p-2"
            name="reference"
            placeholder="Reference (optional)"
          />
          <input
            className="border rounded p-2"
            name="origin"
            defaultValue="US"
            placeholder="Origin ISO"
          />
          <input
            className="border rounded p-2"
            name="dest"
            defaultValue="DE"
            placeholder="Dest ISO"
          />
          <select className="border rounded p-2" name="shippingMode" defaultValue="air">
            <option value="air">air</option>
            <option value="sea">sea</option>
          </select>
          <select className="border rounded p-2" name="pricingMode" defaultValue="auto">
            <option value="auto">auto</option>
            <option value="fixed">fixed</option>
          </select>
          <button className="col-span-2 rounded bg-black text-white px-3 py-2 mt-2">Create</button>
        </form>
      </section>
    </div>
  );
}
