import { db } from '@clearcost/db';
import { sql } from 'drizzle-orm';

/** Default lock key if you don't set a custom one on the route. */
export function makeLockKey(meta: { source: string; job: string }, extra?: string) {
  return extra ? `${meta.source}:${meta.job}:${extra}` : `${meta.source}:${meta.job}`;
}

/** Try to acquire a PG advisory lock for this key. Returns true if lock acquired. */
export async function acquireRunLock(key: string): Promise<boolean> {
  const rows = await db.execute(
    sql<{ locked: boolean | 't' | 'f' }>`SELECT pg_try_advisory_lock(hashtext(${key})) AS locked`
  );
  const locked = Array.isArray(rows) ? (rows[0]?.locked as any) : (rows as any)?.locked;
  return locked === true || locked === 't';
}

/** Release the PG advisory lock for this key (no-op if not held). */
export async function releaseRunLock(key: string): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext(${key}))`);
}
