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
 *             If that fails (datasets without partner set), we fall back to a notes LIKE match
 *             (works with UK/EU/US importers that embed partner labels into `notes`).
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

/**
 * Return the best active duty rate for (dest, hs6) on `on`.
 *
 * Ranking logic (when multiple rows are valid at time `on`):
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

  // Common column selection
  const cols = {
    ratePct: dutyRatesTable.ratePct,
    dutyRule: dutyRatesTable.dutyRule,
    partner: dutyRatesTable.partner,
    effectiveFrom: dutyRatesTable.effectiveFrom,
    effectiveTo: dutyRatesTable.effectiveTo,
  };

  // --------------------------------------------------------------------------
  // 1) If caller provided a partner, first try an EXACT partner column match.
  //    We still honor preferFTA when ordering, then pick the CHEAPEST rate.
  // --------------------------------------------------------------------------
  if (partnerIso2) {
    const first = opts.preferFTA ? 'fta' : 'mfn';
    const second = opts.preferFTA ? 'mfn' : 'fta';

    const rulePriority = sql<number>`
      CASE ${dutyRatesTable.dutyRule}
        WHEN ${first} THEN 0
        WHEN ${second} THEN 1
        WHEN 'anti_dumping' THEN 2
        WHEN 'safeguard' THEN 3
        ELSE 9
      END
    `;

    const [partnerRow] = await db
      .select(cols)
      .from(dutyRatesTable)
      .where(and(baseWhere, eq(dutyRatesTable.partner, partnerIso2)))
      .orderBy(
        rulePriority, // honor preferFTA here
        asc(dutyRatesTable.ratePct), // cheapest first
        desc(dutyRatesTable.effectiveFrom)
      )
      .limit(1);

    const exact = asDutyRateRow(partnerRow);
    if (exact) return exact;

    // ----------------------------------------------------------------------
    // 1b) Fallback: some sources don’t set `partner` (e.g., US "Special").
    //     Try a case-insensitive substring match against `notes`.
    //     We also accept "geo:<id>" style tokens present in UK import notes.
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
        // If we’re matching via notes, still prefer FTA (if requested), then cheapest/newest.
        rulePriority,
        asc(dutyRatesTable.ratePct),
        desc(dutyRatesTable.effectiveFrom)
      )
      .limit(1);

    const viaNotes = asDutyRateRow(notesRow);
    if (viaNotes) return viaNotes;
  }

  // --------------------------------------------------------------------------
  // 2) No partner constraint (or none found): general selection by duty_rule priority,
  //    then CHEAPEST rate, then NEWEST effectiveFrom.
  // --------------------------------------------------------------------------
  const first = opts.preferFTA ? 'fta' : 'mfn';
  const second = opts.preferFTA ? 'mfn' : 'fta';

  const rulePriority = sql<number>`
    CASE ${dutyRatesTable.dutyRule}
      WHEN ${first} THEN 0
      WHEN ${second} THEN 1
      WHEN 'anti_dumping' THEN 2
      WHEN 'safeguard' THEN 3
      ELSE 9
    END
  `;

  // If a partner was provided but nothing matched exactly/notes, we still give a
  // slight preference to rows whose partner equals the requested one (in case an
  // importer starts populating it later). This is a soft bias via ORDER BY.
  const partnerBias = partnerIso2
    ? asc(sql`CASE WHEN ${dutyRatesTable.partner} = ${partnerIso2} THEN 0 ELSE 1 END`)
    : undefined;

  const orderBys = [
    ...(partnerBias ? [partnerBias] : []), // optional bias first
    rulePriority, // FTA vs MFN ranking
    asc(dutyRatesTable.ratePct), // lower % is better
    desc(dutyRatesTable.effectiveFrom), // newest first
  ] as const;

  const [row] = await db
    .select(cols)
    .from(dutyRatesTable)
    .where(baseWhere)
    .orderBy(...orderBys)
    .limit(1);

  return asDutyRateRow(row);
}
