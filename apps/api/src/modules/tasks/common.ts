import type { preHandlerHookHandler } from 'fastify';
import { z } from 'zod/v4';

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

const ADMIN_HEADER_SCHEMA = z.object({
  authorization: z.string().optional(),
  'x-admin-token': z.string().optional(),
});

function isAuthorizedAdmin(headers: unknown): boolean {
  const parsed = ADMIN_HEADER_SCHEMA.parse(headers ?? {});
  const expected = process.env.ADMIN_TOKEN ?? '';
  const presented =
    parsed['x-admin-token'] || parsed.authorization?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(expected && presented === expected);
}

export const adminGuard: preHandlerHookHandler = (req, reply, done) => {
  if (!isAuthorizedAdmin(req.headers)) {
    reply.unauthorized('Admin token required');
    return;
  }
  done();
};
