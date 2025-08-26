import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'clearcost_' });

type Labels = { source: string; job: string; dest?: string };

export const importRowsFetched = new Counter({
  name: 'clearcost_import_rows_fetched_total',
  help: 'Rows fetched from external sources (pre-insert).',
  labelNames: ['source', 'job', 'dest'] as const,
  registers: [registry],
});

export const importRowsInserted = new Counter({
  name: 'clearcost_import_rows_inserted_total',
  help: 'Rows successfully inserted/upserted.',
  labelNames: ['source', 'job', 'dest'] as const,
  registers: [registry],
});

export const importRowsSkipped = new Counter({
  name: 'clearcost_import_rows_skipped_total',
  help: 'Rows skipped (invalid, incomplete, filtered).',
  labelNames: ['source', 'job', 'dest'] as const,
  registers: [registry],
});

export const importErrors = new Counter({
  name: 'clearcost_import_errors_total',
  help: 'Errors during import pipeline.',
  labelNames: ['source', 'job', 'dest', 'stage'] as const,
  registers: [registry],
});

export const importDuration = new Histogram({
  name: 'clearcost_import_duration_seconds',
  help: 'Import duration by source/job/dest.',
  labelNames: ['source', 'job', 'dest'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const importLastRun = new Gauge({
  name: 'clearcost_import_last_run_timestamp',
  help: 'UNIX timestamp (seconds) of last successful import for labels.',
  labelNames: ['source', 'job', 'dest'] as const,
  registers: [registry],
});

export function startImportTimer(labels: Labels) {
  const end = importDuration.startTimer(labels);
  return () => end();
}

export function setLastRunNow(labels: Labels) {
  importLastRun.set(labels, Date.now() / 1000);
}
