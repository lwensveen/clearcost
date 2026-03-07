import 'server-only';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL?.trim();
  const token = process.env.REDIS_TOKEN?.trim();
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ── In-memory fallback rate limiter (used when Redis is unavailable) ──
const memCounters = new Map<string, { count: number; windowStart: number }>();

// Periodic cleanup of stale in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of memCounters) {
    if (now - entry.windowStart >= 120_000) {
      memCounters.delete(k);
    }
  }
}, 60_000).unref();

function isRateLimitedInMemory(key: string, max: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memCounters.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    memCounters.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > max;
}

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 * Falls back to in-memory rate limiting if Redis is unavailable or errors.
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) return isRateLimitedInMemory(key, max, windowSeconds);

  try {
    const redisKey = `rl:${key}`;
    const count = await r.incr(redisKey);
    if (count === 1) {
      await r.expire(redisKey, windowSeconds);
    }
    return count > max;
  } catch (err: unknown) {
    console.error('Redis rate-limit error, falling back to in-memory:', err);
    return isRateLimitedInMemory(key, max, windowSeconds);
  }
}
