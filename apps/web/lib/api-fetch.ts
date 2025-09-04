export const API_BASE = process.env.CLEARCOST_API_URL!;
const API_KEY = process.env.CLEARCOST_WEB_SERVER_KEY!;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', API_KEY);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`${res.status} ${msg}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export function genIdemKey() {
  return 'ck_idem_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
