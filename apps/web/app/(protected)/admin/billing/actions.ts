'use server';

const API = process.env.CLEARCOST_API_URL!;
const KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

async function postJSON(path: string, body: any) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await r.text().catch(() => `${r.status}`));
  return r.json();
}

export async function createCheckout(plan: 'starter' | 'growth' | 'scale', returnUrl?: string) {
  const { url } = await postJSON('/v1/billing/checkout', { plan, returnUrl });
  return url as string;
}

export async function openPortal(returnUrl?: string) {
  const { url } = await postJSON('/v1/billing/portal', { returnUrl });
  return url as string;
}
