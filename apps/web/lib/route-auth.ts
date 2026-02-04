import 'server-only';
import { getAuth } from '@/auth';
import { errorJson } from '@/lib/http';

type RouteSessionContext = {
  userId: string;
  role: string;
};

type RouteAuthResult =
  | { ok: true; session: RouteSessionContext }
  | { ok: false; response: Response };

export async function requireSession(req: Request): Promise<RouteAuthResult> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, response: errorJson('Unauthorized', 401) };
  }

  const roleValue = (session.user as Record<string, unknown>).role;
  const role = typeof roleValue === 'string' ? roleValue.toLowerCase() : 'user';
  return { ok: true, session: { userId, role } };
}

export async function requireAdmin(req: Request): Promise<RouteAuthResult> {
  const authResult = await requireSession(req);
  if (!authResult.ok) return authResult;

  if (!authResult.session.role.includes('admin')) {
    return { ok: false, response: errorJson('Forbidden', 403) };
  }

  return authResult;
}
