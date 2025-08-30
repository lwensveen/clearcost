import { db, dutyRatesTable } from '@clearcost/db';
import { and, asc, desc, eq, gt, isNull, lte, or, sql, SQL } from 'drizzle-orm';

export type DutyRateRow = {
  ratePct: number;
  dutyRule: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard' | 'other' | null;
  partner: string | null;
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

/** Internal helper to normalize the final row into a plain object. */
function asDutyRateRow(
  row:
    | {
        ratePct: unknown;
        dutyRule: unknown;
        partner: string | null;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
      }
    | undefined
): DutyRateRow | null {
  if (!row) return null;
  return {
    ratePct: row.ratePct != null ? Number(row.ratePct as number) : 0,
    dutyRule: (row.dutyRule as DutyRateRow['dutyRule']) ?? null,
    partner: row.partner ?? null,
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
export async function getActiveDutyRate(
  dest: string,
  hs6: string,
  on: Date,
  opts: GetActiveDutyRateOpts = {}
): Promise<DutyRateRow | null> {
  const destA2 = dest.toUpperCase();
  const hs6Key = String(hs6).slice(0, 6);
  const partnerIso2 = opts.partner?.trim().toUpperCase() || null;

  // Base validity & key filter
  const baseWhere = and(
    eq(dutyRatesTable.dest, destA2),
    eq(dutyRatesTable.hs6, hs6Key),
    lte(dutyRatesTable.effectiveFrom, on),
    or(isNull(dutyRatesTable.effectiveTo), gt(dutyRatesTable.effectiveTo, on))
  );

  const cols = {
    ratePct: dutyRatesTable.ratePct,
    dutyRule: dutyRatesTable.dutyRule,
    partner: dutyRatesTable.partner,
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
    if (exact) return exact;

    // ----------------------------------------------------------------------
    // 1b) Fallback: datasets without `partner` set (e.g., US “Special”),
    //     try notes-based match. Keep source preference first.
    // ----------------------------------------------------------------------
    const needle = `%${opts.partner!.trim().toLowerCase()}%`;
    const notesMatch: SQL<boolean> = sql`
      lower(coalesce(${dutyRatesTable.notes}, '')) LIKE ${needle}
    `;

    const [notesRow] = await db
      .select(cols)
      .from(dutyRatesTable)
      .where(and(baseWhere, notesMatch))
      .orderBy(
        sourcePriority,
        rulePriority,
        asc(dutyRatesTable.ratePct),
        desc(dutyRatesTable.effectiveFrom)
      )
      .limit(1);

    const viaNotes = asDutyRateRow(notesRow);
    if (viaNotes) return viaNotes;
  }

  // --------------------------------------------------------------------------
  // 2) General selection: prefer authoritative source, then rule, price, recency.
  // --------------------------------------------------------------------------
  const rulePriority = makeRulePriority(Boolean(opts.preferFTA));

  // Soft bias: if a partner was requested, prefer rows that happen to match it.
  const partnerBias = partnerIso2
    ? asc(sql`CASE WHEN ${dutyRatesTable.partner} = ${partnerIso2} THEN 0 ELSE 1 END`)
    : undefined;

  const orderBys = [
    sourcePriority, // OFFICIAL > … > WITS baseline
    ...(partnerBias ? ([partnerBias] as const) : []),
    rulePriority,
    asc(dutyRatesTable.ratePct),
    desc(dutyRatesTable.effectiveFrom),
  ] as const;

  const [row] = await db
    .select(cols)
    .from(dutyRatesTable)
    .where(baseWhere)
    .orderBy(...orderBys)
    .limit(1);

  return asDutyRateRow(row);
}
