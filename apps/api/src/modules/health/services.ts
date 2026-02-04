import { db } from '@clearcost/db';
import { sql } from 'drizzle-orm';
import { HealthSchema, type Health } from '@clearcost/types';

const FX_MAX_AGE_HOURS = Number(process.env.FX_MAX_AGE_HOURS ?? 48);

export { HealthSchema };

export async function checkHealth(opts: { publicView?: boolean } = {}): Promise<Health> {
  const publicView = opts.publicView ?? false;
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

  const dbLatencyPublic = publicView ? null : dbLatencyMs;
  const fxLatestPublic = publicView ? null : fxLatest;
  const fxAgeHoursPublic = publicView ? null : fxAgeHours;
  const commitPublic = publicView
    ? null
    : process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA;
  const envPublic = publicView ? 'public' : process.env.NODE_ENV || 'development';

  return {
    ok,
    service: 'clearcost-api',
    time: {
      server: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    db: { ok: dbOk, latencyMs: dbLatencyPublic },
    fxCache: {
      ok: fxOk,
      latest: fxLatestPublic,
      ageHours: fxAgeHoursPublic,
      maxAgeHours: FX_MAX_AGE_HOURS,
    },
    version: {
      commit: commitPublic ?? null,
      env: envPublic,
    },
    durationMs: Date.now() - startedAt,
  };
}
