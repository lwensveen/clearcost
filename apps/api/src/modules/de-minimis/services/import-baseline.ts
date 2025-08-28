import { db, deMinimisTable } from '@clearcost/db';

const EU = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
];

export async function seedDeMinimisBaseline(on = new Date()) {
  const effectiveFrom = new Date(on.toISOString().slice(0, 10));

  await db.transaction(async (tx) => {
    // US: Section 321 → intrinsic $800 (duty-side)
    await tx
      .insert(deMinimisTable)
      .values({
        dest: 'US',
        deMinimisKind: 'DUTY',
        deMinimisBasis: 'INTRINSIC',
        currency: 'USD',
        value: '800',
        effectiveFrom,
        effectiveTo: null,
      })
      .onConflictDoUpdate({
        target: [deMinimisTable.dest, deMinimisTable.deMinimisKind, deMinimisTable.effectiveFrom],
        set: { deMinimisBasis: 'INTRINSIC', currency: 'USD', value: '800', updatedAt: new Date() },
      });

    // EU: duty-only €150 intrinsic
    for (const cc of EU) {
      await tx
        .insert(deMinimisTable)
        .values({
          dest: cc,
          deMinimisKind: 'DUTY',
          deMinimisBasis: 'INTRINSIC',
          currency: 'EUR',
          value: '150',
          effectiveFrom,
          effectiveTo: null,
        })
        .onConflictDoUpdate({
          target: [deMinimisTable.dest, deMinimisTable.deMinimisKind, deMinimisTable.effectiveFrom],
          set: {
            deMinimisBasis: 'INTRINSIC',
            currency: 'EUR',
            value: '150',
            updatedAt: new Date(),
          },
        });
    }

    // GB: VAT up to £135 on intrinsic consignment value
    await tx
      .insert(deMinimisTable)
      .values({
        dest: 'GB',
        deMinimisKind: 'VAT',
        deMinimisBasis: 'INTRINSIC',
        currency: 'GBP',
        value: '135',
        effectiveFrom,
        effectiveTo: null,
      })
      .onConflictDoUpdate({
        target: [deMinimisTable.dest, deMinimisTable.deMinimisKind, deMinimisTable.effectiveFrom],
        set: { deMinimisBasis: 'INTRINSIC', currency: 'GBP', value: '135', updatedAt: new Date() },
      });
  });

  return { ok: true };
}
