import { db } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { z } from 'zod/v4';

const FX_MAX_AGE_HOURS = Number(process.env.FX_MAX_AGE_HOURS ?? 48);

export const HealthSchema = z.object({
  ok: z.boolean(),
  service: z.string().default('clearcost-api'),
  time: z.object({
    server: z.string(),
    uptimeSec: z.number(),
    tz: z.string(),
  }),
  db: z.object({
    ok: z.boolean(),
    latencyMs: z.number().nullable(),
  }),
  fxCache: z.object({
    ok: z.boolean().nullable(),
    latest: z.string().nullable(),
    ageHours: z.number().nullable(),
    maxAgeHours: z.number(),
  }),
  version: z.object({
    commit: z.string().nullable(),
    env: z.string(),
  }),
  durationMs: z.number(),
});

type Health = z.infer<typeof HealthSchema>;

export async function checkHealth(): Promise<Health> {
  const startedAt = Date.now();

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    dbOk = true;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
    dbLatencyMs = null;
  }

  let fxOk: boolean | null = null;
  let fxLatest: string | null = null;
  let fxAgeHours: number | null = null;
  try {
    const r: any = await db.execute(sql`SELECT MAX(as_of) AS latest FROM fx_rates`);
    const latest = r?.rows?.[0]?.latest ?? r?.[0]?.latest ?? null;
    if (latest) {
      const dt = new Date(latest);
      fxLatest = dt.toISOString();
      fxAgeHours = Math.max(0, (Date.now() - dt.getTime()) / 36e5);
      fxOk = fxAgeHours <= FX_MAX_AGE_HOURS;
    } else {
      fxOk = false;
    }
  } catch {
    fxOk = null;
  }

  const ok = dbOk && (fxOk === null || fxOk);

  return {
    ok,
    service: 'clearcost-api',
    time: {
      server: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    fxCache: {
      ok: fxOk,
      latest: fxLatest,
      ageHours: fxAgeHours,
      maxAgeHours: FX_MAX_AGE_HOURS,
    },
    version: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || null,
      env: process.env.NODE_ENV || 'development',
    },
    durationMs: Date.now() - startedAt,
  };
}
