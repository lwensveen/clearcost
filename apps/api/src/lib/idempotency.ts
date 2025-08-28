import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db, idempotencyKeysTable } from '@clearcost/db';

function stableStringify(obj: unknown): string {
  const seen = new WeakSet();
  const norm = (v: any): any => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return null;
      seen.add(v);
      if (Array.isArray(v)) return v.map(norm);
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, norm(v[k])])
      );
    }
    return v;
  };
  return JSON.stringify(norm(obj));
}

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

type IdemOptions<T> = {
  /**
   * If returning a cached response, this hook may produce a refreshed one.
   * Return `null` to keep the cached value.
   */
  onReplay?: (cached: T) => Promise<T | null>;
  /**
   * If provided, only call onReplay when the cached row is older than this.
   */
  maxAgeMs?: number;
};

/**
 * Idempotency guard for (scope, key, requestHash).
 * - If first time: runs `producer`, stores result, returns it.
 * - If conflict (same key, different payload): throws 409.
 * - If already completed: returns cached (optionally refreshes via onReplay/maxAgeMs).
 * - If in-flight: throws 409 "Processing".
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  scope: string,
  key: string,
  requestBody: unknown,
  producer: () => Promise<T>,
  options: IdemOptions<T> = {}
): Promise<T> {
  if (!key) {
    throw Object.assign(new Error('Idempotency key required'), { statusCode: 400 });
  }

  const requestHash = sha256(stableStringify(requestBody));
  const now = new Date();

  return db.transaction(async (tx) => {
    // 1) Ensure a row exists (pending) for this scope/key
    await tx
      .insert(idempotencyKeysTable)
      .values({ scope, key, requestHash, status: 'pending' })
      .onConflictDoNothing({ target: [idempotencyKeysTable.scope, idempotencyKeysTable.key] });

    // 2) Try to claim ONLY "pending" rows (avoid grabbing completed/failed)
    const [claimed] = await tx
      .update(idempotencyKeysTable)
      .set({ status: 'processing', lockedAt: now, updatedAt: now })
      .where(
        and(
          eq(idempotencyKeysTable.scope, scope),
          eq(idempotencyKeysTable.key, key),
          eq(idempotencyKeysTable.status, 'pending'),
          sql`${idempotencyKeysTable.lockedAt} IS NULL`
        )
      )
      .returning({
        requestHash: idempotencyKeysTable.requestHash,
      });

    if (claimed) {
      // We successfully claimed the work
      if (claimed.requestHash !== requestHash) {
        throw Object.assign(new Error('Idempotency key reused with different payload'), {
          statusCode: 409,
        });
      }

      try {
        const data = await producer();

        await tx
          .update(idempotencyKeysTable)
          .set({
            status: 'completed',
            response: data,
            updatedAt: new Date(),
            lockedAt: null,
          })
          .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));

        return data;
      } catch (err: any) {
        await tx
          .update(idempotencyKeysTable)
          .set({
            status: 'failed',
            response: { error: String(err?.message ?? err) },
            updatedAt: new Date(),
            lockedAt: null,
          })
          .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));

        throw err;
      }
    }

    // 3) Someone else created/claimed it; inspect existing row
    const [row] = await tx
      .select({
        status: idempotencyKeysTable.status,
        requestHash: idempotencyKeysTable.requestHash,
        response: idempotencyKeysTable.response,
        updatedAt: idempotencyKeysTable.updatedAt,
      })
      .from(idempotencyKeysTable)
      .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)))
      .limit(1);

    if (!row) {
      throw Object.assign(new Error('Idempotency record missing; retry'), { statusCode: 409 });
    }

    if (row.requestHash !== requestHash) {
      throw Object.assign(new Error('Idempotency key reused with different payload'), {
        statusCode: 409,
      });
    }

    if (row.status === 'completed' && row.response) {
      const cached = row.response as T;

      // Respect staleness gate if provided
      const stale =
        typeof options.maxAgeMs === 'number' && row.updatedAt
          ? now.getTime() - new Date(row.updatedAt).getTime() > options.maxAgeMs
          : true; // if no maxAgeMs, let onReplay decide

      if (options.onReplay && stale) {
        const maybe = await options.onReplay(cached);
        if (maybe) {
          await tx
            .update(idempotencyKeysTable)
            .set({ response: maybe, updatedAt: new Date() })
            .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));
          return maybe;
        }
      }

      return cached;
    }

    // In-flight or failed
    if (row.status === 'failed') {
      throw Object.assign(new Error('Previous attempt failed; use a new key'), { statusCode: 409 });
    }

    throw Object.assign(new Error('Processing'), { statusCode: 409 });
  });
}
