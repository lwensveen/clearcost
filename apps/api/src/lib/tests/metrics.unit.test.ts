import { beforeEach, describe, expect, it } from 'vitest';
import {
  importErrors,
  importRowsFetched,
  importRowsInserted,
  importRowsSkipped,
  registry,
  setLastRunNow,
  startImportTimer,
} from '../metrics.js';

async function getValue(
  metricName: string,
  labels: Record<string, string>
): Promise<number | undefined> {
  const all = await registry.getMetricsAsJSON();
  const m = all.find((x) => x.name === metricName);
  if (!m) return undefined;
  const s = m.values.find((v) => Object.entries(labels).every(([k, val]) => v.labels?.[k] === val));
  return s?.value;
}

describe('import metrics', () => {
  const labels = { importSource: 'WITS', job: 'seed', dest: 'TH' };

  beforeEach(() => {
    registry.resetMetrics();
  });

  it('increments counters with labels', async () => {
    importRowsFetched.labels(labels.importSource, labels.job, labels.dest).inc(3);
    importRowsInserted.labels(labels.importSource, labels.job, labels.dest).inc(2);
    importRowsSkipped.labels(labels.importSource, labels.job, labels.dest).inc(1);
    importErrors.labels(labels.importSource, labels.job, labels.dest, 'parse').inc(4);

    expect(await getValue('clearcost_import_rows_fetched_total', labels)).toBe(3);
    expect(await getValue('clearcost_import_rows_inserted_total', labels)).toBe(2);
    expect(await getValue('clearcost_import_rows_skipped_total', labels)).toBe(1);
    expect(await getValue('clearcost_import_errors_total', { ...labels, stage: 'parse' })).toBe(4);
  });

  it('records histogram duration via startImportTimer()', async () => {
    const end = startImportTimer(labels);
    await new Promise((r) => setTimeout(r, 15));
    end();

    const text = await registry.metrics();
    expect(text).toContain('clearcost_import_duration_seconds_count');
    expect(text).toMatch(/clearcost_import_duration_seconds_count\{[^}]*}\s+1/m);
    expect(text).toContain('clearcost_import_duration_seconds_sum');
    const sumMatch = text.match(/clearcost_import_duration_seconds_sum\{[^}]*}\s+([\d.]+)/m);
    expect(sumMatch).toBeTruthy();
    expect(Number(sumMatch![1])).toBeGreaterThan(0);
  });

  it('sets last-run gauge to ~now', async () => {
    setLastRunNow(labels);
    const val = await getValue('clearcost_import_last_run_timestamp', labels);
    expect(val).toBeDefined();
    const now = Date.now() / 1000;
    expect(Math.abs((val ?? 0) - now)).toBeLessThan(5);
  });
});
