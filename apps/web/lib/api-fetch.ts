export function upstream() {
  const baseUrl = process.env.CLEARCOST_API_URL!;
  const apiKey = process.env.CLEARCOST_WEB_SERVER_KEY!; // tenant-scoped server key
  if (!baseUrl || !apiKey) throw new Error('Missing CLEARCOST_API_URL / CLEARCOST_WEB_SERVER_KEY');

  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': init.method && init.method !== 'GET' ? 'application/json' : '',
        'x-api-key': apiKey,
        ...(init.headers as Record<string, string>),
      },
      cache: 'no-store',
      // keep cookies off this hop
      credentials: 'omit',
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        msg = (JSON.parse(text)?.error as string) || msg;
      } catch {}
      throw new Error(`${res.status} ${msg || 'request failed'}`);
    }

    const ctype = res.headers.get('content-type') || '';
    return ctype.includes('application/json') ? JSON.parse(text) : text;
  }

  return { call };
}
