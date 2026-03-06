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

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 * Falls back to allowing the request if Redis is unavailable.
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) return false; // fail open when Redis is not configured

  try {
    const redisKey = `rl:${key}`;
    const count = await r.incr(redisKey);
    if (count === 1) {
      await r.expire(redisKey, windowSeconds);
    }
    return count > max;
  } catch {
    return false; // fail open on Redis errors
  }
}
