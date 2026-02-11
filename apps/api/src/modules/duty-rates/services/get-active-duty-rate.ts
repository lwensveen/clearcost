import { db, dutyRatesTable } from '@clearcost/db';
import { and, asc, desc, eq, gt, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import type { LookupResult } from '../../../lib/lookup-meta.js';

export type DutyRateRow = {
  id: string;
  ratePct: number;
  dutyRule: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard' | 'other' | null;
  partner: string | null;
  source: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

/**
 * Optional selection controls:
 * - preferFTA: if true, rank FTA rows above MFN (still falls back to MFN/others).
 * - partner:  ISO2 origin to prefer (e.g., "JP"). We first try an exact partner column match.
 *             If that fails (datasets without partner set), we fall back to a notes LIKE match.
 */
export type GetActiveDutyRateOpts = {
  preferFTA?: boolean;
  partner?: string; // ISO2 origin (recommended).
};

export type DutyRateLookupResult = LookupResult<DutyRateRow | null>;

/**
 * Build a partner-token regex pattern for SQL/JS matching.
 * Uses non-letter boundaries to avoid false positives like partner "IN" matching "china".
 */
export function partnerTokenPattern(partnerIso2: string): string {
  const token = partnerIso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(token)) return '';
  return `(^|[^A-Z])${token}([^A-Z]|$)`;
}

/** Pure helper to validate token-boundary matching behavior in unit tests. */
export function noteHasPartnerToken(note: string | null | undefined, partnerIso2: string): boolean {
  const pattern = partnerTokenPattern(partnerIso2);
  if (!pattern) return false;
  const re = new RegExp(pattern, 'i');
  return re.test(note ?? '');
}

function normalizePartnerIso2(value: string | null | undefined): string {
  const token = String(value ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(token) ? token : '';
}

/** Partner-empty rows are global (MFN/baseline) and are safe fallback candidates. */
export function isGlobalPartnerRow(partnerIso2: string | null | undefined): boolean {
  return normalizePartnerIso2(partnerIso2) === '';
}

/**
 * For origin-aware fallback, never apply a duty row that is specific to another partner.
 * Accept only exact-partner rows or global (partner-empty) rows.
 */
export function isPartnerCompatibleFallbackRow(
  rowPartnerIso2: string | null | undefined,
  requestedPartnerIso2: string | null | undefined
): boolean {
  const requested = normalizePartnerIso2(requestedPartnerIso2);
  if (!requested) return true;
  const rowPartner = normalizePartnerIso2(rowPartnerIso2);
  return rowPartner === '' || rowPartner === requested;
}

/** Internal helper to normalize the final row into a plain object. */
function asDutyRateRow(
  row:
    | {
        id: string;
        ratePct: unknown;
        dutyRule: unknown;
        partner: string | null;
        source: string | null;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
      }
    | undefined
): DutyRateRow | null {
  if (!row) return null;
  return {
    id: row.id,
    ratePct: row.ratePct != null ? Number(row.ratePct as number) : 0,
    dutyRule: (row.dutyRule as DutyRateRow['dutyRule']) ?? null,
    partner: row.partner ?? null,
    source: row.source ?? null,
    effectiveFrom: row.effectiveFrom ?? null,
    effectiveTo: row.effectiveTo ?? null,
  };
}

/** Order helpers shared by the queries */
function makeRulePriority(preferFTA: boolean) {
  const first = preferFTA ? 'fta' : 'mfn';
  const second = preferFTA ? 'mfn' : 'fta';
  return sql<number>`
    CASE ${dutyRatesTable.dutyRule}
      WHEN ${first} THEN 0
      WHEN ${second} THEN 1
      WHEN 'anti_dumping' THEN 2
      WHEN 'safeguard' THEN 3
      ELSE 9
    END
  `;
}

/** Prefer authoritative sources to baseline */
const sourcePriority = sql<number>`
  CASE ${dutyRatesTable.source}
    WHEN 'official' THEN 0
    WHEN 'manual'  THEN 1
    WHEN 'vendor'  THEN 2
    WHEN 'wits'    THEN 3
    ELSE 9
  END
`;

async function getDutyDatasetInfo(
  destA2: string
): Promise<{ dataset: string | null; effectiveFrom: Date | null } | null> {
  const [row] = await db
    .select({
      dataset: dutyRatesTable.source,
      effectiveFrom: dutyRatesTable.effectiveFrom,
    })
    .from(dutyRatesTable)
    .where(eq(dutyRatesTable.dest, destA2))
    .orderBy(desc(dutyRatesTable.effectiveFrom))
    .limit(1);

  if (!row) return null;
  return { dataset: row.dataset ?? null, effectiveFrom: row.effectiveFrom ?? null };
}

/**
 * Return the best active duty rate for (dest, hs6) on `on`.
 *
 * Ranking logic (when multiple rows are valid at time `on`):
 *   0) Prefer authoritative source (official > manual > vendor > wits),
 *   1) If opts.partner provided:
 *        1a) prefer exact partner column match,
 *        1b) else try notes-based match (fallback),
 *   2) Otherwise (or if no partner hit), pick by:
 *        - duty_rule priority (FTA vs MFN depending on preferFTA),
 *        - then LOWER rate first (cheapest),
 *        - then NEWER effectiveFrom (tie-break).
 */
export async function getActiveDutyRateWithMeta(
  dest: string,
  hs6: string,
  on: Date,
  opts: GetActiveDutyRateOpts = {}
): Promise<DutyRateLookupResult> {
  try {
    const destA2 = dest.toUpperCase();
    const hs6Key = String(hs6).slice(0, 6);
    const partnerIso2 = normalizePartnerIso2(opts.partner ?? null) || null;

    // Base validity & key filter
    const baseWhere = and(
      eq(dutyRatesTable.dest, destA2),
      eq(dutyRatesTable.hs6, hs6Key),
      lte(dutyRatesTable.effectiveFrom, on),
      or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, on))
    );

    const cols = {
      id: dutyRatesTable.id,
      ratePct: dutyRatesTable.ratePct,
      dutyRule: dutyRatesTable.dutyRule,
      partner: dutyRatesTable.partner,
      source: dutyRatesTable.source,
      effectiveFrom: dutyRatesTable.effectiveFrom,
      effectiveTo: dutyRatesTable.effectiveTo,
    };

    // --------------------------------------------------------------------------
    // 1) If caller provided a partner, first try an EXACT partner column match.
    //    Prefer authoritative source, then preferFTA, then cheapest/newest.
    // --------------------------------------------------------------------------
    if (partnerIso2) {
      const rulePriority = makeRulePriority(Boolean(opts.preferFTA));

      const [partnerRow] = await db
        .select(cols)
        .from(dutyRatesTable)
        .where(and(baseWhere, eq(dutyRatesTable.partner, partnerIso2)))
        .orderBy(
          sourcePriority, // OFFICIAL > … > WITS (baseline)
          rulePriority, // honor preferFTA here
          asc(dutyRatesTable.ratePct), // cheapest
          desc(dutyRatesTable.effectiveFrom) // newest
        )
        .limit(1);

      const exact = asDutyRateRow(partnerRow);
      if (exact) {
        return {
          value: exact,
          meta: {
            status: 'ok',
            dataset: exact.source ?? null,
            effectiveFrom: exact.effectiveFrom ?? null,
            note: 'partner_exact',
          },
        };
      }

      // ----------------------------------------------------------------------
      // 1b) Fallback: datasets without `partner` set (e.g., US “Special”),
      //     try notes-based match. Keep source preference first.
      // ----------------------------------------------------------------------
      const pattern = partnerTokenPattern(partnerIso2);
      const notesMatch: SQL<boolean> = pattern
        ? sql`upper(coalesce(${dutyRatesTable.notes}, '')) ~ ${pattern}`
        : sql`false`;

      const notesRows = await db
        .select(cols)
        .from(dutyRatesTable)
        .where(and(baseWhere, notesMatch))
        .orderBy(
          sourcePriority,
          rulePriority,
          asc(dutyRatesTable.ratePct),
          desc(dutyRatesTable.effectiveFrom)
        )
        .limit(100);

      const notesRow = notesRows.find((row) => isGlobalPartnerRow(row.partner));
      const viaNotes = asDutyRateRow(notesRow);
      if (viaNotes) {
        return {
          value: viaNotes,
          meta: {
            status: 'ok',
            dataset: viaNotes.source ?? null,
            effectiveFrom: viaNotes.effectiveFrom ?? null,
            note: 'partner_notes_fallback',
          },
        };
      }
    }

    // --------------------------------------------------------------------------
    // 2) General selection: prefer authoritative source, then rule, price, recency.
    // --------------------------------------------------------------------------
    const rulePriority = makeRulePriority(Boolean(opts.preferFTA));

    const orderBys = [
      sourcePriority, // OFFICIAL > … > WITS baseline
      rulePriority,
      asc(dutyRatesTable.ratePct),
      desc(dutyRatesTable.effectiveFrom),
    ] as const;

    const rows = await db
      .select(cols)
      .from(dutyRatesTable)
      .where(baseWhere)
      .orderBy(...orderBys)
      .limit(partnerIso2 ? 500 : 1);

    const row = partnerIso2
      ? rows.find((candidate) => isPartnerCompatibleFallbackRow(candidate.partner, partnerIso2))
      : rows[0];
    const value = asDutyRateRow(row);
    if (value) {
      return {
        value,
        meta: {
          status: 'ok',
          dataset: value.source ?? null,
          effectiveFrom: value.effectiveFrom ?? null,
        },
      };
    }

    const datasetInfo = await getDutyDatasetInfo(destA2);
    return {
      value: null,
      meta: datasetInfo
        ? {
            status: 'no_match',
            dataset: datasetInfo.dataset,
            effectiveFrom: datasetInfo.effectiveFrom,
          }
        : { status: 'no_dataset', dataset: null, effectiveFrom: null },
    };
  } catch (error: unknown) {
    return {
      value: null,
      meta: {
        status: 'error',
        note: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getActiveDutyRate(
  dest: string,
  hs6: string,
  on: Date,
  opts: GetActiveDutyRateOpts = {}
): Promise<DutyRateRow | null> {
  const out = await getActiveDutyRateWithMeta(dest, hs6, on, opts);
  return out.value;
}
