// import { describe, expect, it } from 'vitest';
// import { db, deMinimisTable } from '@clearcost/db';
// import { quoteLandedCost } from '../src/modules/quotes/services/quote-landed-cost.js';
// import { eq } from 'drizzle-orm';
//
// const hasDB = !!process.env.DATABASE_URL;
//
// describe.skipIf(!hasDB)('de-minimis', () => {
//   it('suppresses duty+VAT under US $800', async () => {
//     await db.delete(deMinimisTable).where(eq(deMinimisTable.dest, 'US'));
//
//     await db.insert(deMinimisTable).values({
//       dest: 'US',
//       currency: 'USD',
//       value: '800',
//       appliesTo: 'DUTY_VAT',
//       effectiveFrom: new Date('2024-01-01'),
//     });
//
//     const { quote } = await quoteLandedCost({
//       categoryKey: 'furniture',
//       mode: 'air',
//       origin: 'TH',
//       dest: 'US',
//       itemValue: { amount: 100, currency: 'USD' },
//       weightKg: 1,
//       dimsCm: { l: 10, w: 10, h: 10 },
//       hs6: '940360',
//       incoterm: 'DAP',
//     });
//
//     expect(quote.deMinimis.under).toBe(true);
//     expect(quote.components.duty).toBe(0);
//     expect(quote.components.vat).toBe(0);
//   });
// });
