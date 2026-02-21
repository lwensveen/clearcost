import { importErrors, importRowsInserted, setLastRunNow, startImportTimer } from '../metrics.js';
import { finishImportRun, type ImportSource, startImportRun } from '../provenance.js';
import { acquireRunLock, makeLockKey, releaseRunLock } from '../run-lock.js';

export type Command = (args: string[]) => Promise<void>;

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function withRun<T>(
  ctx: {
    importSource: ImportSource;
    job: string;
    params?: any;
    lockKey?: string;
    version?: string;
    sourceKey?: string;
    sourceUrl?: string;
  },
  work: (importId: string) => Promise<{ inserted: number; payload: T }>
): Promise<T> {
  const lockKey = ctx.lockKey ?? makeLockKey({ importSource: ctx.importSource, job: ctx.job });
  const paramsRecord =
    ctx.params && typeof ctx.params === 'object' ? (ctx.params as Record<string, unknown>) : null;
  const sourceKey = nonEmptyString(ctx.sourceKey) ?? nonEmptyString(paramsRecord?.sourceKey);
  const sourceUrl = nonEmptyString(ctx.sourceUrl) ?? nonEmptyString(paramsRecord?.sourceUrl);
  const lockAcquired = await acquireRunLock(lockKey);
  const end = startImportTimer({ importSource: ctx.importSource, job: ctx.job });
  if (!lockAcquired) {
    importErrors.inc({ importSource: ctx.importSource, job: ctx.job, stage: 'lock' });
    end();
    throw new Error(`Import already running for lock key: ${lockKey}`);
  }

  let runId: string | null = null;
  try {
    const startParams = {
      importSource: ctx.importSource,
      job: ctx.job,
      params: ctx.params ?? {},
      ...(ctx.version ? { version: ctx.version } : {}),
      ...(sourceKey ? { sourceKey } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    } satisfies Parameters<typeof startImportRun>[0];
    const run = await startImportRun({
      ...startParams,
    });
    runId = run.id;
    const { inserted, payload } = await work(run.id);

    importRowsInserted.inc({ importSource: ctx.importSource, job: ctx.job }, inserted ?? 0);
    setLastRunNow({ importSource: ctx.importSource, job: ctx.job });
    end();
    await finishImportRun(run.id, { importStatus: 'succeeded', inserted });

    return payload;
  } catch (err: any) {
    end();
    importErrors.inc({ importSource: ctx.importSource, job: ctx.job, stage: 'script' });
    if (runId) {
      await finishImportRun(runId, { importStatus: 'failed', error: String(err?.message ?? err) });
    }
    throw err;
  } finally {
    await releaseRunLock(lockKey).catch(() => undefined);
  }
}
