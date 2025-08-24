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
          .map((k) => [k, norm((v as any)[k])])
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
   * If we’re returning a previously completed response, this hook can
   * optionally produce a fresh response (e.g., when a Stripe Checkout Session
   * has expired). Return `null` to keep the cached value.
   */
  onReplay?: (cached: T) => Promise<T | null>;
  /**
   * Optional staleness threshold. If provided, we’ll invoke onReplay only when
   * the cached row is older than this many ms. If omitted, onReplay can still
   * decide based on the cached contents whether to refresh.
   */
  maxAgeMs?: number;
};

/**
 * Ensures an action is executed at most once for (scope, key) + requestHash.
 * - If completed before, returns stored response (or refreshed via onReplay).
 * - If key is reused with different body, throws 409 error.
 * - If pending and locked by someone else, throws 409 'processing'.
 */
export async function withIdempotency<T extends Record<string, unknown>>(
  scope: string,
  key: string,
  requestBody: unknown,
  handler: () => Promise<T>,
  options?: IdemOptions<T>
): Promise<T> {
  const requestHash = sha256(stableStringify(requestBody));

  return db.transaction(async (tx) => {
    await tx
      .insert(idempotencyKeysTable)
      .values({ scope, key, requestHash, status: 'pending' })
      .onConflictDoNothing({ target: [idempotencyKeysTable.scope, idempotencyKeysTable.key] });

    const [claimed] = await tx
      .update(idempotencyKeysTable)
      .set({ lockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(idempotencyKeysTable.scope, scope),
          eq(idempotencyKeysTable.key, key),
          sql`${idempotencyKeysTable.lockedAt} IS NULL`
        )
      )
      .returning();

    if (claimed) {
      if (claimed.requestHash !== requestHash) {
        throw Object.assign(new Error('Idempotency key reused with different payload'), {
          statusCode: 409,
        });
      }

      try {
        const data = await handler();
        await tx
          .update(idempotencyKeysTable)
          .set({
            status: 'completed',
            response: data as any,
            updatedAt: new Date(),
            lockedAt: null,
          })
          .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));
        return data;
      } catch (err) {
        await tx
          .update(idempotencyKeysTable)
          .set({
            status: 'failed',
            response: { error: String((err as any)?.message ?? err) } as any,
            updatedAt: new Date(),
            lockedAt: null,
          })
          .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));
        throw err;
      }
    }

    const [row] = await tx
      .select()
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
      const resp = row.response as T;

      if (options?.onReplay) {
        const maybe = await options.onReplay(resp);
        if (maybe) {
          await tx
            .update(idempotencyKeysTable)
            .set({ response: maybe as any, updatedAt: new Date() })
            .where(and(eq(idempotencyKeysTable.scope, scope), eq(idempotencyKeysTable.key, key)));
          return maybe;
        }
      }

      return resp;
    }

    // 3b) Not completed yet
    throw Object.assign(new Error('Processing'), { statusCode: 409 });
  });
}
