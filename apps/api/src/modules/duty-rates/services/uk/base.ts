import { z } from 'zod/v4';
import { httpFetch } from '../../../../lib/http.js';

export const DATASET_ID = 'uk-tariff-2021-01-01';
export const TABLE_ID = 'commodities';
export const UK_10_DATA_API_BASE =
  process.env.UK_10_DATA_API_BASE ?? 'https://data.api.trade.gov.uk';

export const MEASURE_TYPE_MFN = '103'; // Third country duty (MFN)
export const MEASURE_TYPE_PREF_STD = '142'; // Tariff preference
export const MEASURE_TYPE_PREF_ENDUSE = '145'; // Preference under end-use
export const ERGA_OMNES_ID = '1011';

export async function httpGet(url: string, opts: RequestInit = {}) {
  return httpFetch(url, {
    ...opts,
    headers: { 'user-agent': 'clearcost-importer', ...(opts.headers || {}) },
  });
}

/** Latest immutable dataset version id, e.g. "v4.0.1083". */
export async function getLatestVersionIdFromBase(apiBaseUrl: string): Promise<string> {
  const url = `${apiBaseUrl}/v1/datasets/${DATASET_ID}/versions?format=json`;
  const res = await httpGet(url);
  if (!res.ok) throw new Error(`DBT versions failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { versions: Array<{ id: string }> };
  const ids = (j?.versions ?? []).map((v) => v.id);
  if (!ids.length) throw new Error('No versions available for UK tariff dataset');

  return ids.sort((a, b) => {
    const pa = a.replace(/^v/i, '').split('.').map(Number);
    const pb = b.replace(/^v/i, '').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] ?? 0,
        db = pb[i] ?? 0;
      if (da !== db) return db - da;
    }
    return 0;
  })[0]!;
}

/** Latest immutable dataset version id from configured default API base. */
export async function getLatestVersionId(): Promise<string> {
  return await getLatestVersionIdFromBase(UK_10_DATA_API_BASE);
}

/** Zod for the columns we use (others pass through). */
export const UkRowSchema = z
  .object({
    commodity__code: z.string().regex(/^\d{10}$/),
    measure__type__id: z.string(),
    geographical_area__id: z.string().optional(),
    geographical_area__description: z.string().optional(),
    duty_rate: z.string().optional(),
    validity_start_date: z.string().optional(),
    validity_end_date: z.string().optional(),
    measure__generating_regulation__validity_start_date: z.string().optional(),
    measure__generating_regulation__validity_end_date: z.string().optional(),
  })
  .passthrough();

/** Extract the first ad-valorem %; returns null if none. */
export function parseAdValoremPercent(duty: string | undefined): number | null {
  if (!duty) return null;
  const m = duty.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const val = Number(m[1]);
  return Number.isFinite(val) && val >= 0 ? val : null;
}

/** Heuristic: detect non-% components (specific/compound). */
export function hasCompoundComponent(duty: string | undefined): boolean {
  if (!duty) return false;
  return /(GBP|EUR|USD|\bper\b|\/\s*(kg|g|l|m|item|pcs|pair|hl|t))/i.test(duty);
}

/** numeric(6,3) as string (e.g., 21 -> "21.000"), avoids "-0.000". */
export function toNumeric3String(n: number): string {
  const s = n.toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
}

/** Pick start/end dates from possible columns. */
export function pickStartEnd(row: z.infer<typeof UkRowSchema>) {
  const startRaw =
    row.validity_start_date ?? row.measure__generating_regulation__validity_start_date;
  const endRaw =
    row.validity_end_date ?? row.measure__generating_regulation__validity_end_date ?? null;
  const start = startRaw ? new Date(`${startRaw}T00:00:00Z`) : undefined;
  const end = endRaw ? new Date(`${endRaw}T00:00:00Z`) : null;
  return { start, end };
}

/** S3-Select helper (returns array or null if unsupported). */
export async function s3Select(versionId: string, query: string): Promise<any[] | null> {
  const url = `${UK_10_DATA_API_BASE}/v1/datasets/${DATASET_ID}/versions/${versionId}/data?format=json&query-s3-select=${encodeURIComponent(query)}`;
  const res = await httpGet(url);
  if (!res.ok) return null;
  try {
    const j = await res.json();
    if (Array.isArray(j)) return j;
    if (Array.isArray(j.records)) return j.records;
    return null;
  } catch {
    return null;
  }
}
