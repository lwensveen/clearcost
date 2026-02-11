import 'dotenv/config';

import { db, dutyRatesTable, fxRatesTable, importsTable, vatRulesTable } from '@clearcost/db';
import { sql } from 'drizzle-orm';

const FX_AS_OF = new Date('2026-01-15T00:00:00.000Z');
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

const HS6_CODES = ['850440', '851830', '852290', '852910'] as const;

async function seedFx() {
  await db
    .insert(fxRatesTable)
    .values({
      // 1 USD -> 0.92 EUR demo FX rate used by MVP golden tests.
      base: 'USD',
      quote: 'EUR',
      rate: '0.92000000',
      fxAsOf: FX_AS_OF,
      provider: 'ecb',
      sourceRef: 'demo-mvp-seed',
    })
    .onConflictDoUpdate({
      target: [fxRatesTable.base, fxRatesTable.quote, fxRatesTable.fxAsOf],
      set: {
        rate: sql`excluded.rate`,
        provider: sql`excluded.provider`,
        sourceRef: sql`excluded.source_ref`,
        ingestedAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    });
}

async function seedVat() {
  const vatRows = [
    {
      dest: 'NL',
      vatRateKind: 'STANDARD' as const,
      source: 'official' as const,
      // 21% NL standard VAT rate for most goods (demo).
      ratePct: '21.000',
      vatBase: 'CIF_PLUS_DUTY' as const,
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'Demo MVP seed VAT NL',
    },
    {
      dest: 'DE',
      vatRateKind: 'STANDARD' as const,
      source: 'official' as const,
      // 19% DE standard VAT rate for most goods (demo).
      ratePct: '19.000',
      vatBase: 'CIF_PLUS_DUTY' as const,
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'Demo MVP seed VAT DE',
    },
  ];

  for (const row of vatRows) {
    await db
      .insert(vatRulesTable)
      .values(row)
      .onConflictDoUpdate({
        target: [vatRulesTable.dest, vatRulesTable.vatRateKind, vatRulesTable.effectiveFrom],
        set: {
          source: sql`excluded.source`,
          ratePct: sql`excluded.rate_pct`,
          vatBase: sql`excluded.vat_base`,
          effectiveTo: sql`excluded.effective_to`,
          notes: sql`excluded.notes`,
          updatedAt: sql`now()`,
        },
      });
  }
}

async function seedDuty() {
  const dutyRows = HS6_CODES.flatMap((hs6) => [
    {
      dest: 'NL',
      partner: 'US',
      hs6,
      source: 'official' as const,
      // 3.7% demo MFN duty for HS6 850440 (electronics accessory), representative of EU MFN range for 8504.x.
      ratePct: hs6 === '850440' ? '3.700' : '2.500',
      dutyRule: 'mfn' as const,
      currency: 'EUR',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'Demo MVP seed duty US->NL',
    },
    {
      dest: 'DE',
      partner: 'US',
      hs6,
      source: 'official' as const,
      // 3.7% demo MFN duty for HS6 850440 (electronics accessory), representative of EU MFN range for 8504.x.
      ratePct: hs6 === '850440' ? '3.700' : '2.500',
      dutyRule: 'mfn' as const,
      currency: 'EUR',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'Demo MVP seed duty US->DE',
    },
    {
      dest: 'DE',
      partner: 'NL',
      hs6,
      source: 'official' as const,
      // Intra-EU demo lane (including HS6 851830): import duty is zero.
      ratePct: '0.000',
      dutyRule: 'mfn' as const,
      currency: 'EUR',
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      notes: 'Demo MVP seed duty NL->DE intra-EU',
    },
  ]);

  for (const row of dutyRows) {
    await db
      .insert(dutyRatesTable)
      .values(row)
      .onConflictDoUpdate({
        target: [
          dutyRatesTable.dest,
          dutyRatesTable.partner,
          dutyRatesTable.hs6,
          dutyRatesTable.dutyRule,
          dutyRatesTable.effectiveFrom,
        ],
        set: {
          source: sql`excluded.source`,
          ratePct: sql`excluded.rate_pct`,
          currency: sql`excluded.currency`,
          effectiveTo: sql`excluded.effective_to`,
          notes: sql`excluded.notes`,
          updatedAt: sql`now()`,
        },
      });
  }
}

async function seedImportFreshness() {
  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - 30_000);

  await db.insert(importsTable).values([
    {
      importSource: 'ECB',
      job: 'fx:daily',
      version: 'demo-mvp-v1',
      sourceUrl: 'demo://seed/fx',
      params: JSON.stringify({ lanes: ['US->NL', 'US->DE', 'NL->DE'] }),
      fileHash: null,
      fileBytes: null,
      importStatus: 'succeeded',
      inserted: 1,
      updated: 0,
      error: null,
      startedAt,
      finishedAt,
    },
    {
      importSource: 'OFFICIAL',
      job: 'vat:auto',
      version: 'demo-mvp-v1',
      sourceUrl: 'demo://seed/vat',
      params: JSON.stringify({ destinations: ['NL', 'DE'] }),
      fileHash: null,
      fileBytes: null,
      importStatus: 'succeeded',
      inserted: 2,
      updated: 0,
      error: null,
      startedAt,
      finishedAt,
    },
    {
      importSource: 'TARIC',
      job: 'duties:eu-mfn',
      version: 'demo-mvp-v1',
      sourceUrl: 'demo://seed/duty',
      params: JSON.stringify({ hs6: HS6_CODES }),
      fileHash: null,
      fileBytes: null,
      importStatus: 'succeeded',
      inserted: HS6_CODES.length * 3,
      updated: 0,
      error: null,
      startedAt,
      finishedAt,
    },
  ]);
}

async function main() {
  await seedFx();
  await seedVat();
  await seedDuty();
  await seedImportFreshness();

  console.log('MVP demo seed complete');
  console.log(`FX as-of: ${FX_AS_OF.toISOString()}`);
  console.log(`VAT destinations: NL, DE`);
  console.log(`Duty HS6 rows seeded: ${HS6_CODES.join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed MVP demo data', error);
    process.exit(1);
  });
