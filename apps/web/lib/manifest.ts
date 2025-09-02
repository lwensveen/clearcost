import 'server-only';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

function headers(extra?: HeadersInit) {
  return {
    'x-api-key': KEY,
    'content-type': 'application/json',
    ...extra,
  };
}

export async function fetchManifests() {
  const r = await fetch(`${API}/v1/manifests?limit=100`, {
    headers: headers(),
    next: { tags: ['manifests'] },
  });
  if (!r.ok) throw new Error('Failed to load manifests');
  return r.json() as Promise<{
    items: Array<{ id: string; name?: string | null; createdAt?: string | null }>;
  }>;
}

export async function fetchManifestFull(id: string) {
  const r = await fetch(`${API}/v1/manifests/${id}/full`, {
    headers: headers(),
    next: { tags: [`manifest:${id}`] },
  });
  if (!r.ok) throw new Error('Failed to load manifest');
  return r.json();
}

export async function fetchManifestQuote(id: string) {
  const r = await fetch(`${API}/v1/manifests/${id}/quote`, {
    headers: headers(),
    next: { tags: [`manifest:${id}`, `manifest:${id}:quote`] },
  });
  if (r.status === 404) return null; // no quote yet
  if (!r.ok) throw new Error('Failed to load quote');
  return r.json() as Promise<{
    ok: true;
    manifestId: string;
    summary: {
      itemsCount: number;
      currency?: string;
      freight: number;
      duty: number;
      vat: number;
      fees: number;
      checkoutVat?: number | null;
      grandTotal: number;
      fxAsOf?: string;
      updatedAt: string;
    };
    items: Array<{
      id: string;
      currency?: string;
      basis: number;
      chargeableKg?: number | null;
      freightShare: number;
      components: { CIF: number; duty: number; vat: number; fees: number; checkoutVAT?: number };
    }>;
  }>;
}

export async function computeManifest(
  id: string,
  args: { allocation: 'chargeable' | 'volumetric' | 'weight'; dryRun?: boolean } = {
    allocation: 'chargeable',
    dryRun: false,
  }
) {
  const r = await fetch(`${API}/v1/manifests/${id}/compute`, {
    method: 'POST',
    headers: headers({ 'idempotency-key': crypto.randomUUID() }),
    body: JSON.stringify({ allocation: args.allocation, dryRun: !!args.dryRun }),
    cache: 'no-store',
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Compute failed: ${r.status} ${t}`);
  }
  return r.json();
}
