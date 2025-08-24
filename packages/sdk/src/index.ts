import {
  ClassifyInput,
  ClassifyResponse,
  IdemOptions,
  QuoteInput,
  QuoteResponse,
  SDKOptions,
} from './types';

export async function genIdemKey(): Promise<string> {
  const bytes = new Uint8Array(16);

  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    g.crypto.getRandomValues(bytes);
  } else {
    const { randomFillSync, webcrypto } = await import('node:crypto');
    if (webcrypto?.getRandomValues) webcrypto.getRandomValues(bytes);
    else randomFillSync(bytes);
  }

  let base64: string;
  if (typeof g.btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    base64 = g.btoa(bin);
  } else {
    base64 = Buffer.from(bytes).toString('base64');
  }

  const b64url = base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `ck_idem_${b64url}`;
}

async function http<T>(
  opts: SDKOptions,
  path: string,
  init: RequestInit & { idem?: string } = {}
): Promise<{ data: T; idemKey?: string }> {
  const f = opts.fetch ?? fetch;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${opts.apiKey}`,
    ...(init.idem ? { 'Idempotency-Key': init.idem } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await f(`${opts.baseUrl}${path}`, { ...init, headers });
  const idemKey = res.headers.get('Idempotency-Key') ?? undefined;
  if (!res.ok) {
    let msg = 'request failed';
    try {
      const j = await res.json();
      msg = typeof j?.error === 'string' ? j.error : msg;
    } catch {}
    throw new Error(`${res.status} ${msg}`);
  }
  return { data: (await res.json()) as T, idemKey };
}

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
