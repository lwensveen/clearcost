import { importErrors, importRowsInserted, setLastRunNow, startImportTimer } from '../metrics.js';
import { finishImportRun, type ImportSource, startImportRun } from '../provenance.js';

export type Command = (args: string[]) => Promise<void>;

export async function withRun<T>(
  ctx: { importSource: ImportSource; job: string; params?: any },
  work: (importId: string) => Promise<{ inserted: number; payload: T }>
): Promise<T> {
  const end = startImportTimer({ importSource: ctx.importSource, job: ctx.job });
  const run = await startImportRun({
    importSource: ctx.importSource,
    job: ctx.job,
    params: ctx.params ?? {},
  });
  try {
    const { inserted, payload } = await work(run.id);

    importRowsInserted.inc({ importSource: ctx.importSource, job: ctx.job }, inserted ?? 0);
    setLastRunNow({ importSource: ctx.importSource, job: ctx.job });
    end();

    await finishImportRun(run.id, { importStatus: 'succeeded', inserted });

    return payload;
  } catch (err: any) {
    end();
    importErrors.inc({ importSource: ctx.importSource, job: ctx.job, stage: 'script' });
    await finishImportRun(run.id, { importStatus: 'failed', error: String(err?.message ?? err) });
    throw err;
  }
}
