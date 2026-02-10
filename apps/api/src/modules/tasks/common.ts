import { httpFetch } from '../../lib/http.js';
import { sha256Hex } from '../../lib/provenance.js';
export const USER_AGENT = 'clearcost-importer';

export type JsonArtifact<T> = {
  data: T;
  sourceUrl: string;
  fileHash: string;
  fileBytes: number;
};

export function assertNonEmptyImportRows(
  rows: { length: number },
  opts: { job: string; sourceUrl?: string; detail?: string }
): void {
  if (rows.length > 0) return;
  const src = opts.sourceUrl ? ` from ${opts.sourceUrl}` : '';
  const detail = opts.detail ? ` (${opts.detail})` : '';
  throw new Error(`[${opts.job}] source produced 0 rows${src}${detail}`);
}

function resolveRemoteUrl(path: string): string {
  const base = (process.env.DATA_REMOTE_BASE ?? '').replace(/\/+$/, '');
  return path.startsWith('http') ? path : `${base}/${path.replace(/^\/+/, '')}`;
}

export async function fetchJSONWithArtifact<T>(path: string): Promise<JsonArtifact<T>> {
  const sourceUrl = resolveRemoteUrl(path);

  const res = await httpFetch(sourceUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status} ${res.statusText} – ${body}`);
  }

  const raw = Buffer.from(await res.arrayBuffer());
  const data = JSON.parse(raw.toString('utf8')) as T;

  return {
    data,
    sourceUrl,
    fileHash: sha256Hex(raw),
    fileBytes: raw.byteLength,
  };
}

export async function fetchJSON<T>(path: string): Promise<T> {
  const out = await fetchJSONWithArtifact<T>(path);
  return out.data;
}
