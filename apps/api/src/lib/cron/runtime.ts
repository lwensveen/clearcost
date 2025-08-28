import { importErrors, importRowsInserted, setLastRunNow, startImportTimer } from '../metrics.js';
import { finishImportRun, type ImportSource, startImportRun } from '../provenance.js';

export type Command = (args: string[]) => Promise<void>;

export const USER_AGENT = 'clearcost-importer';

export async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'user-agent': USER_AGENT } });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Fetch failed ${r.status} ${r.statusText} – ${body}`);
  }

  return (await r.json()) as T;
}

export const toNumeric3String = (n: number | string) => {
  const x = Number(n);
  if (!Number.isFinite(x)) throw new Error(`not a finite number: ${n}`);

  const s = x.toFixed(3);

  return Number(s) === 0 ? '0.000' : s;
};

export const toDateOrNull = (v?: string | null) => (v ? new Date(v) : null);
export const ensureDate = (v: string, field = 'date') => {
  const d = new Date(v);

  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${v}`);

  return d;
};

export const parseCSV = (s: string | undefined) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function parseFlags(argv: string[]) {
  const flags: Record<string, string> = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (!m) continue;

    const key = m[1];
    const value = m[2] ?? '';

    if (key) flags[key] = value;
  }
  return flags;
}

export function buildImportId(kind: string, parts: Array<string | number | undefined> = []) {
  const stamp = new Date().toISOString();
  const suffix = parts.filter(Boolean).join(':');

  return suffix ? `${kind}:${suffix}:${stamp}` : `${kind}:${stamp}`;
}

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

    importRowsInserted.inc({ source: ctx.importSource, job: ctx.job }, inserted ?? 0);
    setLastRunNow({ importSource: ctx.importSource, job: ctx.job });
    end();

    await finishImportRun(run.id, { importStatus: 'succeeded', inserted });

    return payload;
  } catch (err: any) {
    end();
    importErrors.inc({ source: ctx.importSource, job: ctx.job, stage: 'script' });
    await finishImportRun(run.id, { importStatus: 'failed', error: String(err?.message ?? err) });
    throw err;
  }
}
