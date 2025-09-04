export function publicApi() {
  const baseUrl = process.env.CLEARCOST_API_URL!;
  const apiKey = process.env.CLEARCOST_WEB_SERVER_KEY!;
  if (!baseUrl || !apiKey) throw new Error('Missing CLEARCOST_API_URL / CLEARCOST_WEB_SERVER_KEY');

  const join = (p: string) => `${baseUrl.replace(/\/+$/, '')}${p.startsWith('/') ? p : `/${p}`}`;

  async function fetchRaw(path: string, init: RequestInit = {}) {
    const res = await fetch(join(path), {
      ...init,
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(init.method && init.method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        ...(init.headers as Record<string, string>),
      },
      cache: 'no-store',
    });
    return res;
  }

  async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchRaw(path, init);
    const text = await res.text();
    if (!res.ok) {
      let msg = text || 'request failed';
      try {
        const j = JSON.parse(text);
        msg = j?.error ?? j?.message ?? msg;
      } catch {}
      throw new Error(`${res.status} ${msg}`);
    }
    return text ? (JSON.parse(text) as T) : (null as unknown as T);
  }

  function genIdemKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const b64 = btoa(String.fromCharCode(...bytes))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `ck_idem_${b64}`;
  }

  return { fetchJson, fetchRaw, genIdemKey };
}
