import {
  ClassifyInput,
  ClassifyResponse,
  IdemOptions,
  ListManifestsResult,
  ManifestCreateInput,
  ManifestDetail,
  QuoteInput,
  QuoteResponse,
  SDKOptions,
} from './types.js';

// -------------------------------
// Idempotency helpers
// -------------------------------
export async function genIdemKey(): Promise<string> {
  const g: any = globalThis as any;
  const bytes = new Uint8Array(16);

  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }

  let base64: string;
  if (typeof g.btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    base64 = g.btoa(bin);
  } else {
    base64 = Buffer.from(bytes).toString('base64');
  }

  const b64url = base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `ck_idem_${b64url}`;
}

// -------------------------------
// Internal HTTP helper
// -------------------------------
type HttpInit = RequestInit & { idem?: string };

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function http<T = unknown>(
  opts: SDKOptions,
  path: string,
  init: HttpInit = {}
): Promise<{ data: T; idemKey?: string }> {
  if (!opts.baseUrl) throw new Error('SDK baseUrl is required');
  if (!opts.apiKey) throw new Error('SDK apiKey is required');

  const f = opts.fetch ?? fetch;
  const headers: Record<string, string> = {
    authorization: `Bearer ${opts.apiKey}`,
    ...(init.method && init.method !== 'GET' ? { 'content-type': 'application/json' } : {}),
    ...(init.idem ? { 'Idempotency-Key': init.idem } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await f(joinUrl(opts.baseUrl, path), { ...init, headers, cache: 'no-store' });
  const idemKey = res.headers.get('Idempotency-Key') ?? undefined;

  const text = await res.text();
  const ctype = res.headers.get('content-type') ?? '';

  if (!res.ok) {
    // Try to surface a useful error message when JSON-shaped
    try {
      const j = text ? JSON.parse(text) : null;
      const msg = j?.error?.message ?? j?.error ?? j?.message ?? (text || 'request failed');
      throw new Error(`${res.status} ${msg}`);
    } catch {
      throw new Error(`${res.status} ${text || 'request failed'}`);
    }
  }

  // Parse JSON when possible, otherwise return raw text
  const data: any = ctype.includes('application/json') ? (text ? JSON.parse(text) : null) : text;
  return { data: data as T, idemKey };
}

// -------------------------------
// Quotes
// -------------------------------
export async function createQuote(
  sdk: SDKOptions,
  body: QuoteInput,
  opts: IdemOptions = {}
): Promise<{ quote: QuoteResponse; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<QuoteResponse>(sdk, `/v1/quotes`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });
  return { quote: data, idempotencyKey: idem };
}

export async function getQuoteByKey(sdk: SDKOptions, key: string): Promise<QuoteResponse> {
  const { data } = await http<QuoteResponse>(sdk, `/v1/quotes/by-key/${encodeURIComponent(key)}`);
  return data;
}

// -------------------------------
// Classify
// -------------------------------
export async function classify(
  sdk: SDKOptions,
  body: ClassifyInput,
  opts: IdemOptions = {}
): Promise<{ result: ClassifyResponse; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<ClassifyResponse>(sdk, `/v1/classify`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });

  return { result: data, idempotencyKey: idem };
}

// -------------------------------
// Manifests (full set)
// -------------------------------
export async function createManifest(
  sdk: SDKOptions,
  body: ManifestCreateInput,
  opts: IdemOptions = {}
): Promise<{ manifest: ManifestDetail; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests`, {
    method: 'POST',
    body: JSON.stringify(body),
    idem,
  });
  return { manifest: data, idempotencyKey: idem };
}

export async function listManifests(
  sdk: SDKOptions,
  params?: { limit?: number; cursor?: string }
): Promise<ListManifestsResult> {
  const qs: string[] = [];
  if (params?.limit != null) qs.push(`limit=${encodeURIComponent(String(params.limit))}`);
  if (params?.cursor) qs.push(`cursor=${encodeURIComponent(params.cursor)}`);
  const path = `/v1/manifests${qs.length ? `?${qs.join('&')}` : ''}`;
  const { data } = await http<ListManifestsResult>(sdk, path);
  return data;
}

export async function getManifest(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}`);
  return data;
}

export async function getManifestFull(sdk: SDKOptions, id: string): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(sdk, `/v1/manifests/${encodeURIComponent(id)}/full`);
  return data;
}

export async function exportManifestItemsCsv(sdk: SDKOptions, id: string): Promise<string> {
  const { data } = await http<string>(sdk, `/v1/manifests/${encodeURIComponent(id)}/items.csv`, {
    // accept is optional here; backend decides content-type
    method: 'GET',
  });
  return data;
}

export async function importManifestItemsCsv(
  sdk: SDKOptions,
  id: string,
  csv: string,
  opts?: { mode?: 'append' | 'replace'; dryRun?: boolean }
): Promise<unknown> {
  const q = new URLSearchParams();
  if (opts?.mode) q.set('mode', opts.mode);
  if (opts?.dryRun != null) q.set('dryRun', String(!!opts.dryRun));
  const path = `/v1/manifests/${encodeURIComponent(id)}/items:import-csv${
    q.toString() ? `?${q.toString()}` : ''
  }`;

  const { data } = await http<unknown>(sdk, path, {
    method: 'POST',
    headers: { 'content-type': 'text/csv' },
    // body must be plain text (CSV)
    body: csv as any,
  });
  return data;
}

export async function computeManifest(
  sdk: SDKOptions,
  id: string,
  allocation: 'chargeable' | 'volumetric' | 'weight',
  opts: { idempotencyKey?: string; dryRun?: boolean } = {}
): Promise<{ result: unknown; idempotencyKey: string }> {
  const idem = opts.idempotencyKey ?? (await genIdemKey());
  const { data } = await http<unknown>(sdk, `/v1/manifests/${encodeURIComponent(id)}/compute`, {
    method: 'POST',
    idem,
    body: JSON.stringify({ allocation, dryRun: !!opts.dryRun }),
  });
  return { result: data, idempotencyKey: idem };
}

export async function getManifestQuotes(sdk: SDKOptions, id: string): Promise<unknown> {
  const { data } = await http<unknown>(sdk, `/v1/manifests/${encodeURIComponent(id)}/quotes`);
  return data;
}

export async function getManifestQuotesHistory(sdk: SDKOptions, id: string): Promise<unknown> {
  const { data } = await http<unknown>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/quotes/history`
  );
  return data;
}

export async function cloneManifest(
  sdk: SDKOptions,
  id: string,
  name?: string
): Promise<ManifestDetail> {
  const { data } = await http<ManifestDetail>(
    sdk,
    `/v1/manifests/${encodeURIComponent(id)}/clone`,
    {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    }
  );
  return data;
}

export async function deleteManifest(sdk: SDKOptions, id: string): Promise<{ ok: true }> {
  const { data } = await http<{ ok: true }>(sdk, `/v1/manifests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return data;
}
