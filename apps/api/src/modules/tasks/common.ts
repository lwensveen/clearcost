export const USER_AGENT = 'clearcost-importer';

export async function fetchJSON<T>(path: string): Promise<T> {
  const base = (process.env.DATA_REMOTE_BASE ?? '').replace(/\/+$/, '');
  const url = path.startsWith('http') ? path : `${base}/${path.replace(/^\/+/, '')}`;

  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${body}`);
  }
  return res.json() as Promise<T>;
}
