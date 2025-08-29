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

// ---- Flags parsing + typed accessors ---------------------------------------

export type Flags = Record<string, string>; // values are always strings

/** Parse --k=v and bare --k (as "true"). All values are strings. */
export function parseFlags(argv: string[] = []): Flags {
  const flags: Flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    const key = m[1]!.trim();
    const val = (m[2] ?? 'true').trim(); // bare --key => "true"
    if (key) flags[key] = val;
  }
  return flags;
}

/** Get a string flag (empty/whitespace → undefined). */
export function flagStr(flags: Flags, key: string): string | undefined {
  const v = flags?.[key];
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

/** Get a boolean flag. Accepts true/false/1/0/yes/no/on/off (case-insensitive). */
export function flagBool(flags: Flags, key: string): boolean {
  const v = flagStr(flags, key);
  if (v == null) return false;
  return /^(?:1|true|t|yes|y|on)$/i.test(v);
}

/** Get a number flag. Returns undefined if NaN. */
export function flagNum(flags: Flags, key: string): number | undefined {
  const s = flagStr(flags, key);
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Split comma/space-separated flag into array of non-empty tokens. */
export function flagCSV(flags: Flags, key: string): string[] {
  const s = flagStr(flags, key);
  if (!s) return [];
  return s
    .split(/[, \t\r\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
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
