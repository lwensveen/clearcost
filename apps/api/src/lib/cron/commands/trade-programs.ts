import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import {
  db,
  tradeProgramMembersTable,
  tradeProgramsTable,
  countriesTable,
  jurisdictionsTable,
} from '@clearcost/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  cell,
  headerIndex,
  iterateCsvRecords,
} from '../../../modules/duty-rates/utils/stream-csv.js';
import { parseFlags } from '../utils.js';
import { httpFetch } from '../../http.js';

/** --- Minimal seeds --------------------------------------------------- */
const BASE_COUNTRIES: Array<{ iso2: string; name: string; iso3?: string; numeric?: string }> = [
  { iso2: 'US', name: 'United States', iso3: 'USA', numeric: '840' },
  { iso2: 'CA', name: 'Canada', iso3: 'CAN', numeric: '124' },
  { iso2: 'MX', name: 'Mexico', iso3: 'MEX', numeric: '484' },
  { iso2: 'AU', name: 'Australia', iso3: 'AUS', numeric: '036' },
  { iso2: 'IL', name: 'Israel', iso3: 'ISR', numeric: '376' },
  { iso2: 'JO', name: 'Jordan', iso3: 'JOR', numeric: '400' },
  { iso2: 'KR', name: 'Korea, Republic of', iso3: 'KOR', numeric: '410' },
  { iso2: 'MA', name: 'Morocco', iso3: 'MAR', numeric: '504' },
  { iso2: 'OM', name: 'Oman', iso3: 'OMN', numeric: '512' },
  { iso2: 'PA', name: 'Panama', iso3: 'PAN', numeric: '591' },
  { iso2: 'PE', name: 'Peru', iso3: 'PER', numeric: '604' },
  { iso2: 'SG', name: 'Singapore', iso3: 'SGP', numeric: '702' },
  { iso2: 'BH', name: 'Bahrain', iso3: 'BHR', numeric: '048' },
];

type ProgramRow = {
  code: string;
  name: string;
  kind: 'fta' | 'preference' | 'trade_remedy';
  notes?: string;
};

const BASE_PROGRAMS: ProgramRow[] = [
  // FTAs
  { code: 'AU', name: 'United States–Australia FTA', kind: 'fta' },
  { code: 'BH', name: 'United States–Bahrain FTA', kind: 'fta' },
  { code: 'CA', name: 'United States–Canada (CUSMA/USMCA)', kind: 'fta' },
  { code: 'CL', name: 'United States–Chile FTA', kind: 'fta' },
  { code: 'CO', name: 'United States–Colombia FTA', kind: 'fta' },
  { code: 'IL', name: 'United States–Israel FTA', kind: 'fta' },
  { code: 'JO', name: 'United States–Jordan FTA', kind: 'fta' },
  { code: 'KR', name: 'United States–Korea FTA', kind: 'fta' },
  { code: 'MA', name: 'United States–Morocco FTA', kind: 'fta' },
  { code: 'MX', name: 'United States–Mexico (CUSMA/USMCA)', kind: 'fta' },
  { code: 'OM', name: 'United States–Oman FTA', kind: 'fta' },
  { code: 'PA', name: 'United States–Panama FTA', kind: 'fta' },
  { code: 'PE', name: 'United States–Peru FTA', kind: 'fta' },
  { code: 'SG', name: 'United States–Singapore FTA', kind: 'fta' },
  // “Special” tokens (preference buckets)
  { code: 'A', name: 'GSP (Generalized System of Preferences)', kind: 'preference' },
  { code: 'A*', name: 'GSP (Least-Developed Beneficiaries)', kind: 'preference' },
  { code: 'A+', name: 'GSP (Special)', kind: 'preference' },
  { code: 'D', name: 'CBERA/CBTPA', kind: 'preference' },
  { code: 'E', name: 'Insular Possessions', kind: 'preference' },
  { code: 'S', name: 'ATPDEA / Andean', kind: 'preference' },
  { code: 'P', name: 'Other preferential program', kind: 'preference' },
];

/** Helpers */
async function ensureJurisdictionId(ownerCode: string): Promise<string> {
  const code = ownerCode.toUpperCase();
  const [ins] = await db
    .insert(jurisdictionsTable)
    .values({ code, name: code })
    .onConflictDoNothing()
    .returning({ id: jurisdictionsTable.id });
  if (ins?.id) return ins.id;

  const [found] = await db
    .select({ id: jurisdictionsTable.id })
    .from(jurisdictionsTable)
    .where(eq(jurisdictionsTable.code, code))
    .limit(1);
  if (!found) throw new Error(`Jurisdiction not found: ${code}`);
  return found.id;
}

async function getCountryIdMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: countriesTable.id, iso2: countriesTable.iso2 })
    .from(countriesTable);
  const map = new Map<string, string>();
  for (const r of rows) if (r.iso2) map.set(r.iso2.toUpperCase(), r.id);
  return map;
}

async function getProgramIdMap(ownerId: string, codes: string[]): Promise<Map<string, string>> {
  if (!codes.length) return new Map();
  const rows = await db
    .select({ id: tradeProgramsTable.id, code: tradeProgramsTable.code })
    .from(tradeProgramsTable)
    .where(and(eq(tradeProgramsTable.ownerId, ownerId), inArray(tradeProgramsTable.code, codes)));
  const map = new Map<string, string>();
  for (const r of rows) if (r.code) map.set(r.code.toUpperCase(), r.id);
  return map;
}

/** ------------------- Commands ------------------- */

/**
 * Seed base countries, programs (under an owner), and auto 1:1 ISO2 memberships.
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts import:programs:seed
 *   bun run --cwd apps/api src/lib/cron/index.ts import:programs:seed --owner=US
 */
export const programsSeed: Command = async (args) => {
  const flags = parseFlags(args);
  const owner = (flags.owner ? flags.owner : 'US').toUpperCase();

  const payload = await withRun(
    { importSource: 'SEED', job: 'programs:seed', params: { owner } },
    async (importId: string) => {
      // Ensure owner jurisdiction exists (and get id)
      const ownerId = await ensureJurisdictionId(owner);

      // Countries
      if (BASE_COUNTRIES.length) {
        await db
          .insert(countriesTable)
          .values(BASE_COUNTRIES)
          .onConflictDoUpdate({
            target: countriesTable.iso2,
            set: {
              name: sql`EXCLUDED.name`,
              iso3: sql`COALESCE(EXCLUDED.iso3, ${countriesTable.iso3})`,
              numeric: sql`COALESCE(EXCLUDED.numeric, ${countriesTable.numeric})`,
              updatedAt: sql`now()`,
            },
            setWhere: sql`
              ${countriesTable.name}    is distinct from EXCLUDED.name
              OR ${countriesTable.iso3} is distinct from EXCLUDED.iso3
              OR ${countriesTable.numeric} is distinct from EXCLUDED.numeric
            `,
          });
      }

      // Programs (attach ownerId)
      const progVals = BASE_PROGRAMS.map((p) => ({
        ownerId,
        code: p.code,
        name: p.name,
        kind: p.kind,
        notes: p.notes ?? null,
      }));

      await db
        .insert(tradeProgramsTable)
        .values(progVals)
        .onConflictDoUpdate({
          target: [tradeProgramsTable.ownerId, tradeProgramsTable.code],
          set: {
            name: sql`EXCLUDED.name`,
            kind: sql`EXCLUDED.kind`,
            notes: sql`EXCLUDED.notes`,
            updatedAt: sql`now()`,
          },
          setWhere: sql`
            ${tradeProgramsTable.name} is distinct from EXCLUDED.name
            OR ${tradeProgramsTable.kind} is distinct from EXCLUDED.kind
            OR ${tradeProgramsTable.notes} is distinct from EXCLUDED.notes
          `,
        });

      // Build id maps
      const iso2Codes = BASE_PROGRAMS.map((p) => p.code).filter((c) => /^[A-Z]{2}$/.test(c));
      const countryIdByIso2 = await getCountryIdMap();
      const programIdByCode = await getProgramIdMap(ownerId, iso2Codes);

      // Auto-membership for two-letter codes (AU→AU, CA→CA, …)
      if (iso2Codes.length) {
        const memberRows = iso2Codes
          .map((code) => {
            const programId = programIdByCode.get(code);
            const countryId = countryIdByIso2.get(code);
            if (!programId || !countryId) return null;
            return { programId, countryId };
          })
          .filter(Boolean) as Array<{ programId: string; countryId: string }>;

        if (memberRows.length) {
          await db.insert(tradeProgramMembersTable).values(memberRows).onConflictDoNothing();
        }
      }

      const inserted = BASE_COUNTRIES.length + progVals.length + iso2Codes.length; // coarse tally
      return {
        inserted,
        payload: {
          ok: true,
          owner,
          ownerId,
          importId,
          programs: progVals.length,
          countries: BASE_COUNTRIES.length,
          autoMembers: iso2Codes.length,
        },
      };
    }
  );

  console.log(payload);
};

/**
 * Load memberships from CSV.
 * Accepts columns: program (or program_code), iso2, effective_from, effective_to, notes, owner (optional).
 * `owner` column overrides the --owner flag for that row. If neither is present, defaults to 'US'.
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts import:programs:load-members --url=https://…/members.csv --owner=US
 */
export const programsLoadMembersCsv: Command = async (args) => {
  const flags = parseFlags(args);
  const url = flags.url || args?.[0];
  const defaultOwner = (flags.owner || 'US').toUpperCase();

  if (!url) {
    console.error(
      'Usage: import:programs:load-members --url=https://…/spi-members.csv [--owner=US]'
    );
    return;
  }

  const payload = await withRun(
    { importSource: 'CSV', job: 'programs:load-members', params: { url, defaultOwner } },
    async (importId: string) => {
      // Ensure default owner exists
      const defaultOwnerId = await ensureJurisdictionId(defaultOwner);

      // Cache countries (iso2 -> id)
      const countryIdByIso2 = await getCountryIdMap();

      let isHeader = true;
      let iProg = -1,
        iIso = -1,
        iFrom = -1,
        iTo = -1,
        iNotes = -1,
        iOwner = -1;
      let upserts = 0;

      const res = await httpFetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
      if (!res.ok || !res.body) throw new Error(`Fetch ${url} failed: ${res.status}`);

      for await (const rec of iterateCsvRecords(res.body)) {
        if (isHeader) {
          const { idx } = headerIndex(rec);
          iProg = idx('program') ?? idx('program_code') ?? -1;
          iIso = idx('iso2') ?? -1;
          iFrom = idx('effective_from') ?? -1;
          iTo = idx('effective_to') ?? -1;
          iNotes = idx('notes') ?? -1;
          iOwner = idx('owner') ?? -1;
          if (iProg === -1 || iIso === -1) {
            throw new Error('CSV must include at least program (or program_code) and iso2 columns');
          }
          isHeader = false;
          continue;
        }

        const code = (cell(rec, iProg) || '').trim().toUpperCase();
        const iso2 = (cell(rec, iIso) || '').trim().toUpperCase();
        if (!code || !iso2) continue;

        const ownerFromRow = iOwner !== -1 ? (cell(rec, iOwner) || '').trim().toUpperCase() : '';
        const ownerCode = ownerFromRow || defaultOwner;
        const ownerId = ownerFromRow ? await ensureJurisdictionId(ownerCode) : defaultOwnerId;

        // Ensure country exists (lazy add if missing)
        let countryId = countryIdByIso2.get(iso2);
        if (!countryId) {
          const [insCountry] = await db
            .insert(countriesTable)
            .values({ iso2, name: iso2 })
            .onConflictDoNothing()
            .returning({ id: countriesTable.id });
          if (insCountry?.id) {
            countryId = insCountry.id;
            countryIdByIso2.set(iso2, insCountry.id);
          } else {
            const [foundCountry] = await db
              .select({ id: countriesTable.id })
              .from(countriesTable)
              .where(eq(countriesTable.iso2, iso2))
              .limit(1);
            if (!foundCountry) {
              console.warn(`Skipping member row (unknown ISO2): ${iso2}`);
              continue;
            }
            countryId = foundCountry.id;
            countryIdByIso2.set(iso2, foundCountry.id);
          }
        }
        if (!countryId) continue;

        // Ensure program exists (insert minimal if needed)
        let programId: string | undefined;
        const [insProg] = await db
          .insert(tradeProgramsTable)
          .values({
            ownerId,
            code,
            name: code,
            kind: 'fta', // default; can be refined later
            notes: null,
          })
          .onConflictDoNothing()
          .returning({ id: tradeProgramsTable.id });

        if (insProg?.id) {
          programId = insProg.id;
        } else {
          const [foundProg] = await db
            .select({ id: tradeProgramsTable.id })
            .from(tradeProgramsTable)
            .where(and(eq(tradeProgramsTable.ownerId, ownerId), eq(tradeProgramsTable.code, code)))
            .limit(1);
          if (!foundProg) {
            console.warn(`Skipping member row (program not found): ${ownerCode}:${code}`);
            continue;
          }
          programId = foundProg.id;
        }

        if (!programId) continue;

        const fromRaw = (iFrom !== -1 ? cell(rec, iFrom) : '').slice(0, 10) || '1900-01-01';
        const toRaw = (iTo !== -1 ? cell(rec, iTo) : '').slice(0, 10) || '';
        const notes = (iNotes !== -1 ? cell(rec, iNotes) : '') || null;

        const ret = await db
          .insert(tradeProgramMembersTable)
          .values({
            programId,
            countryId,
            effectiveFrom: new Date(`${fromRaw}T00:00:00Z`),
            effectiveTo: toRaw ? new Date(`${toRaw}T00:00:00Z`) : null,
            notes,
          })
          .onConflictDoUpdate({
            target: [
              tradeProgramMembersTable.programId,
              tradeProgramMembersTable.countryId,
              tradeProgramMembersTable.effectiveFrom,
            ],
            set: {
              effectiveTo: sql`EXCLUDED.effective_to`,
              notes: sql`EXCLUDED.notes`,
              updatedAt: sql`now()`,
            },
            setWhere: sql`
              ${tradeProgramMembersTable.effectiveTo} is distinct from EXCLUDED.effective_to
              OR ${tradeProgramMembersTable.notes}       is distinct from EXCLUDED.notes
            `,
          })
          .returning({ id: tradeProgramMembersTable.id });

        upserts += ret.length;
      }

      return { inserted: upserts, payload: { ok: true, defaultOwner, importId, upserts } };
    }
  );

  console.log(payload);
};
