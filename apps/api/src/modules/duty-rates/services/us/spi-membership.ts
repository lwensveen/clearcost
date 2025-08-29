import {
  db,
  jurisdictionsTable,
  tradeProgramMembersTable,
  tradeProgramsTable,
} from '@clearcost/db';
import { countriesTable } from '@clearcost/db/dist/schemas/countries.js';
import { eq } from 'drizzle-orm';
import { cell, headerIndex, iterateCsvRecords } from '../../utils/stream-csv.js';

export type ProgramMember = { iso2: string; from: Date; to: Date | null };

/**
 * Load membership from DB, keyed by program code (e.g., "CA").
 * Also stores an owner-qualified key "OWNER:CODE" (e.g., "US:CA") for lookups that include the owner.
 */
export async function loadMembershipFromDb(): Promise<Map<string, ProgramMember[]>> {
  const rows = await db
    .select({
      ownerCode: jurisdictionsTable.code, // e.g. 'US'
      programCode: tradeProgramsTable.code, // e.g. 'CA'
      iso2: countriesTable.iso2, // member country ISO2
      effectiveFrom: tradeProgramMembersTable.effectiveFrom,
      effectiveTo: tradeProgramMembersTable.effectiveTo,
    })
    .from(tradeProgramMembersTable)
    .innerJoin(tradeProgramsTable, eq(tradeProgramMembersTable.programId, tradeProgramsTable.id))
    .innerJoin(jurisdictionsTable, eq(tradeProgramsTable.ownerId, jurisdictionsTable.id))
    .innerJoin(countriesTable, eq(tradeProgramMembersTable.countryId, countriesTable.id));

  const byProg = new Map<string, ProgramMember[]>();

  for (const r of rows) {
    const codeKey = (r.programCode ?? '').toUpperCase();
    if (!codeKey) continue;

    const push = (key: string) => {
      const list = byProg.get(key) ?? [];
      list.push({
        iso2: (r.iso2 ?? '').toUpperCase(),
        from: r.effectiveFrom!, // not null per schema default
        to: r.effectiveTo ?? null,
      });
      byProg.set(key, list);
    };

    // Plain program code key (e.g., "CA")
    push(codeKey);

    // Owner-qualified key (e.g., "US:CA")
    const owner = (r.ownerCode ?? '').toUpperCase();
    if (owner) push(`${owner}:${codeKey}`);
  }

  return byProg;
}

/**
 * Load membership from a CSV.
 * Supports headers:
 * - program | program_code
 * - (optional) program_owner
 * - iso2
 * - effective_from
 * - effective_to
 */
export async function loadMembershipFromCsv(url: string): Promise<Map<string, ProgramMember[]>> {
  const res = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!res.ok || !res.body) throw new Error(`SPI CSV ${url} failed: ${res.status}`);

  const map = new Map<string, ProgramMember[]>();

  let isHeader = true;
  let iProg = -1,
    iOwner = -1,
    iIso = -1,
    iFrom = -1,
    iTo = -1;

  for await (const rec of iterateCsvRecords(res.body)) {
    if (isHeader) {
      const { idx } = headerIndex(rec);
      iProg = idx('program') ?? idx('program_code') ?? -1;
      iOwner = idx('program_owner') ?? -1;
      iIso = idx('iso2') ?? -1;
      iFrom = idx('effective_from') ?? -1;
      iTo = idx('effective_to') ?? -1;
      isHeader = false;
      continue;
    }

    const code = (cell(rec, iProg) || '').trim().toUpperCase();
    const owner = (iOwner !== -1 ? cell(rec, iOwner) : '').trim().toUpperCase();
    const iso2 = (cell(rec, iIso) || '').trim().toUpperCase();
    if (!code || !iso2) continue;

    const fromRaw = (cell(rec, iFrom) || '').slice(0, 10);
    const toRaw = (cell(rec, iTo) || '').slice(0, 10);
    const from = fromRaw ? new Date(`${fromRaw}T00:00:00Z`) : new Date('1900-01-01T00:00:00Z');
    const to = toRaw ? new Date(`${toRaw}T00:00:00Z`) : null;

    const add = (key: string) => {
      const list = map.get(key) ?? [];
      list.push({ iso2, from, to });
      map.set(key, list);
    };

    add(code);
    if (owner) add(`${owner}:${code}`);
  }

  return map;
}

/**
 * Return ISO2 members of a program effective on a given date.
 * `program` can be "CODE" (e.g., "CA") or "OWNER:CODE" (e.g., "US:CA").
 */
export function membersOn(
  membership: Map<string, ProgramMember[]>,
  program: string,
  on: Date
): string[] {
  const key = (program || '').toUpperCase();
  const ymd = on.toISOString().slice(0, 10);

  let list = membership.get(key) ?? [];
  if (list.length === 0 && key.includes(':')) {
    const codeOnly = key.split(':', 2)[1] ?? '';
    list = membership.get(codeOnly) ?? [];
  }

  const out = new Set<string>();
  for (const m of list) {
    const from = m.from?.toISOString().slice(0, 10) ?? '0000-01-01';
    const to = m.to ? m.to.toISOString().slice(0, 10) : null;
    if (ymd >= from && (!to || ymd < to)) out.add(m.iso2);
  }
  return Array.from(out);
}
