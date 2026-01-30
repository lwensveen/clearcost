import 'server-only';
import { UpstreamError, extractErrorMessage } from './errors';
import { requireEnvStrict } from './env';

export function upstream() {
  const baseUrl = requireEnvStrict('CLEARCOST_API_URL');
  const apiKey = requireEnvStrict('CLEARCOST_WEB_SERVER_KEY'); // tenant-scoped server key

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
        msg = extractErrorMessage(JSON.parse(text), msg || 'request failed');
      } catch {
        // ignore JSON parse errors
      }
      throw new UpstreamError(res.status, `${res.status} ${msg || 'request failed'}`, text);
    }

    const ctype = res.headers.get('content-type') || '';
    return ctype.includes('application/json') ? JSON.parse(text) : text;
  }

  return { call };
}
