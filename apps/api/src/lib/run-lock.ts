import { db } from '@clearcost/db';
import { sql } from 'drizzle-orm';

export async function acquireLockOrThrow(key: string): Promise<void> {
  const rows = await db.execute(sql`SELECT pg_try_advisory_lock(hashtext(${key})) AS ok`);
  const ok = (rows as unknown as Array<{ ok: boolean }>)[0]?.ok;
  if (!ok) throw new Error(`Import already running: ${key}`);
}

export async function releaseLock(key: string): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${key}))`);
}
