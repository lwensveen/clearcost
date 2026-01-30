import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import {
  countriesTable,
  db,
  jurisdictionsTable,
  tradeProgramMembersTable,
  tradeProgramsTable,
} from '@clearcost/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { parseFlags } from '../utils.js';

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';

/** --- helpers --- */
function ymdUtc(year: number, m: number, d: number) {
  return new Date(Date.UTC(year, m - 1, d, 0, 0, 0));
}

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

/** Minimal country set we actually need for US FTAs today. */
const BASIC_COUNTRIES: Array<{ iso2: string; name: string; iso3?: string }> = [
  { iso2: 'US', name: 'United States', iso3: 'USA' },
  { iso2: 'AU', name: 'Australia', iso3: 'AUS' },
  { iso2: 'BH', name: 'Bahrain', iso3: 'BHR' },
  { iso2: 'CA', name: 'Canada', iso3: 'CAN' },
  { iso2: 'CL', name: 'Chile', iso3: 'CHL' },
  { iso2: 'CO', name: 'Colombia', iso3: 'COL' },
  { iso2: 'IL', name: 'Israel', iso3: 'ISR' },
  { iso2: 'JO', name: 'Jordan', iso3: 'JOR' },
  { iso2: 'KR', name: 'Korea, Republic of', iso3: 'KOR' },
  { iso2: 'MA', name: 'Morocco', iso3: 'MAR' },
  { iso2: 'MX', name: 'Mexico', iso3: 'MEX' },
  { iso2: 'OM', name: 'Oman', iso3: 'OMN' },
  { iso2: 'PA', name: 'Panama', iso3: 'PAN' },
  { iso2: 'PE', name: 'Peru', iso3: 'PER' },
  { iso2: 'SG', name: 'Singapore', iso3: 'SGP' },
];

/** US program codes you’ll see in the HTS “Special” column. */
const US_PROGRAMS: Array<{
  code: string;
  name: string;
  description?: string;
  kind: 'fta' | 'preference' | 'trade_remedy';
  defaultStart?: Date;
}> = [
  {
    code: 'AU',
    name: 'Australia–United States Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2005, 1, 1),
  },
  {
    code: 'BH',
    name: 'Bahrain–United States Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2006, 8, 1),
  },
  {
    code: 'CA',
    name: 'Canada (USMCA/NAFTA lineage)',
    kind: 'fta',
    defaultStart: ymdUtc(2020, 7, 1),
  },
  {
    code: 'MX',
    name: 'Mexico (USMCA/NAFTA lineage)',
    kind: 'fta',
    defaultStart: ymdUtc(2020, 7, 1),
  },
  {
    code: 'CL',
    name: 'United States–Chile Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2004, 1, 1),
  },
  {
    code: 'CO',
    name: 'United States–Colombia TPA',
    kind: 'fta',
    defaultStart: ymdUtc(2012, 5, 15),
  },
  {
    code: 'IL',
    name: 'United States–Israel Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(1985, 9, 1),
  },
  {
    code: 'JO',
    name: 'United States–Jordan Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2001, 12, 17),
  },
  {
    code: 'KR',
    name: 'United States–Korea FTA (KORUS)',
    kind: 'fta',
    defaultStart: ymdUtc(2012, 3, 15),
  },
  {
    code: 'MA',
    name: 'United States–Morocco Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2006, 1, 1),
  },
  {
    code: 'OM',
    name: 'United States–Oman Free Trade Agreement',
    kind: 'fta',
    defaultStart: ymdUtc(2009, 1, 1),
  },
  { code: 'PA', name: 'United States–Panama TPA', kind: 'fta', defaultStart: ymdUtc(2012, 10, 31) },
  { code: 'PE', name: 'United States–Peru TPA', kind: 'fta', defaultStart: ymdUtc(2009, 2, 1) },
  {
    code: 'SG',
    name: 'United States–Singapore FTA',
    kind: 'fta',
    defaultStart: ymdUtc(2004, 1, 1),
  },
  // preference tokens
  {
    code: 'A',
    name: 'GSP (Generalized System of Preferences)',
    kind: 'preference',
    description: 'Placeholder token; beneficiaries vary.',
  },
  {
    code: 'A*',
    name: 'GSP (Least-Developed Beneficiaries)',
    kind: 'preference',
    description: 'Placeholder token.',
  },
  { code: 'A+', name: 'GSP (Special)', kind: 'preference', description: 'Placeholder token.' },
  {
    code: 'D',
    name: 'CBERA/CBTPA',
    kind: 'preference',
    description: 'Group token; seed members later.',
  },
  {
    code: 'E',
    name: 'Insular Possessions',
    kind: 'preference',
    description: 'Group token; seed members later.',
  },
  {
    code: 'S',
    name: 'ATPDEA / Andean',
    kind: 'preference',
    description: 'Group token; seed members later.',
  },
  {
    code: 'P',
    name: 'Other preferential program',
    kind: 'preference',
    description: 'Group token; seed members later.',
  },
];

/** For bilateral FTAs, seed the obvious single-member mappings. */
const US_PROGRAM_MEMBERS: Array<{
  programCode: string;
  iso2: string;
  effectiveFrom?: Date;
  notes?: string;
}> = [
  { programCode: 'AU', iso2: 'AU' },
  { programCode: 'BH', iso2: 'BH' },
  { programCode: 'CA', iso2: 'CA', notes: 'USMCA (replacing NAFTA) – Canada' },
  { programCode: 'MX', iso2: 'MX', notes: 'USMCA (replacing NAFTA) – Mexico' },
  { programCode: 'CL', iso2: 'CL' },
  { programCode: 'CO', iso2: 'CO' },
  { programCode: 'IL', iso2: 'IL' },
  { programCode: 'JO', iso2: 'JO' },
  { programCode: 'KR', iso2: 'KR' },
  { programCode: 'MA', iso2: 'MA' },
  { programCode: 'OM', iso2: 'OM' },
  { programCode: 'PA', iso2: 'PA' },
  { programCode: 'PE', iso2: 'PE' },
  { programCode: 'SG', iso2: 'SG' },
];

async function upsertCountries(rows: typeof BASIC_COUNTRIES, dryRun = false) {
  if (dryRun) {
    if (DEBUG) console.log(`[Seed] DRY-RUN countries: ${rows.length}`);
    return { insertedOrUpdated: rows.length };
  }
  const ret = await db
    .insert(countriesTable)
    .values(rows)
    .onConflictDoUpdate({
      target: countriesTable.iso2,
      set: {
        name: sql`EXCLUDED.name`,
        iso3: sql`COALESCE(EXCLUDED.iso3, ${countriesTable.iso3})`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`
        ${countriesTable.name} is distinct from EXCLUDED.name
        OR ${countriesTable.iso3} is distinct from EXCLUDED.iso3
      `,
    })
    .returning({ iso2: countriesTable.iso2 });
  return { insertedOrUpdated: ret.length };
}

async function upsertPrograms(ownerId: string, rows = US_PROGRAMS, dryRun = false) {
  const vals = rows.map((r) => ({
    ownerId,
    code: r.code,
    name: r.name,
    kind: r.kind ?? 'fta',
    notes: r.description ?? null,
  }));

  if (dryRun) {
    if (DEBUG) console.log(`[Seed] DRY-RUN programs(ownerId=${ownerId}): ${vals.length}`);
    return { insertedOrUpdated: vals.length };
  }

  const ret = await db
    .insert(tradeProgramsTable)
    .values(vals)
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
    })
    .returning({ id: tradeProgramsTable.id });
  return { insertedOrUpdated: ret.length };
}

async function upsertProgramMembers(
  ownerId: string,
  rows = US_PROGRAM_MEMBERS,
  defaultStart = ymdUtc(2000, 1, 1),
  dryRun = false
) {
  // Build id maps
  const programCodes = Array.from(new Set(rows.map((r) => r.programCode.toUpperCase())));
  const iso2s = Array.from(new Set(rows.map((r) => r.iso2.toUpperCase())));

  const programIdByCode = await getProgramIdMap(ownerId, programCodes);
  const countryIdByIso2 = await getCountryIdMap();

  const vals = rows
    .map((r) => {
      const programId = programIdByCode.get(r.programCode.toUpperCase());
      const countryId = countryIdByIso2.get(r.iso2.toUpperCase());
      if (!programId || !countryId) return null;
      return {
        programId,
        countryId,
        effectiveFrom: r.effectiveFrom ?? defaultStart,
        effectiveTo: null as Date | null,
        notes: r.notes ?? null,
      };
    })
    .filter(Boolean) as Array<{
    programId: string;
    countryId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    notes: string | null;
  }>;

  if (dryRun) {
    if (DEBUG)
      console.log(
        `[Seed] DRY-RUN program-members(ownerId=${ownerId}): ${vals.length} (defaultStart=${defaultStart.toISOString().slice(0, 10)})`
      );
    return { insertedOrUpdated: vals.length };
  }

  const ret = await db
    .insert(tradeProgramMembersTable)
    .values(vals)
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

  return { insertedOrUpdated: ret.length };
}

/** ------------------- Commands ------------------- */

/**
 * Seed a small set of countries (idempotent).
 */
export const seedCountriesBasic: Command = async (args) => {
  const flags = parseFlags(args);
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun({ importSource: 'SEED', job: 'seed:countries:basic' }, async () => {
    const res = await upsertCountries(BASIC_COUNTRIES, dryRun);
    return { inserted: res.insertedOrUpdated, payload: res };
  });

  console.log(payload);
};

/**
 * Seed US trade programs + members (idempotent).
 *
 * Usage:
 *   bun run --cwd apps/api src/lib/cron/index.ts seed:trade-programs:us
 *   bun run --cwd apps/api src/lib/cron/index.ts seed:trade-programs:us --dryRun
 *   bun run --cwd apps/api src/lib/cron/index.ts seed:trade-programs:us --owner=US
 */
export const seedTradeProgramsUS: Command = async (args) => {
  const flags = parseFlags(args);
  const owner = (flags.owner ?? 'US').toString().toUpperCase();
  const dryRun = Boolean(flags.dryRun);

  const payload = await withRun(
    { importSource: 'SEED', job: 'seed:trade-programs:us', params: { owner, dryRun } },
    async () => {
      // make sure owner exists and get its id
      const ownerId = await ensureJurisdictionId(owner);

      // make sure countries exist first
      const countries = await upsertCountries(BASIC_COUNTRIES, dryRun);
      const programs = await upsertPrograms(ownerId, US_PROGRAMS, dryRun);
      const members = await upsertProgramMembers(
        ownerId,
        US_PROGRAM_MEMBERS,
        ymdUtc(2000, 1, 1),
        dryRun
      );

      return {
        inserted:
          countries.insertedOrUpdated + programs.insertedOrUpdated + members.insertedOrUpdated,
        payload: { owner, ownerId, countries, programs, members },
      };
    }
  );

  console.log(payload);
};
