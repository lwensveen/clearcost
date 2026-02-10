import { db, freightRateCardsTable, freightRateStepsTable, provenanceTable } from '@clearcost/db';
import { eq, sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';
import { FreightCardsImportSchema, type FreightCardImport } from '@clearcost/types';
import { requireFreightIso3 } from './lane-country-code.js';

type ImportOpts = {
  batchSize?: number;
  importId?: string;
  makeSourceRef?: (card: FreightCardImport) => string | undefined;
  enforceCoverageGuardrails?: boolean;
  minCoverageRetention?: number;
};

const ymd = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const DEFAULT_MIN_COVERAGE_RETENTION = 0.5;

type CoverageSnapshot = {
  laneCount: number;
  destinationCount: number;
};

function laneKey(card: Pick<FreightCardImport, 'origin' | 'dest' | 'freightMode' | 'freightUnit'>) {
  return `${card.origin}|${card.dest}|${card.freightMode}|${card.freightUnit}`;
}

function summarizeCoverage(cards: FreightCardImport[]): CoverageSnapshot {
  const lanes = new Set<string>();
  const dests = new Set<string>();
  for (const card of cards) {
    lanes.add(laneKey(card));
    dests.add(card.dest);
  }
  return {
    laneCount: lanes.size,
    destinationCount: dests.size,
  };
}

async function currentCoverageSnapshot(): Promise<CoverageSnapshot> {
  const laneRows = await db
    .selectDistinct({
      origin: freightRateCardsTable.origin,
      dest: freightRateCardsTable.dest,
      freightMode: freightRateCardsTable.freightMode,
      freightUnit: freightRateCardsTable.freightUnit,
    })
    .from(freightRateCardsTable);

  const destRows = await db
    .selectDistinct({
      dest: freightRateCardsTable.dest,
    })
    .from(freightRateCardsTable);

  return {
    laneCount: laneRows.length,
    destinationCount: destRows.length,
  };
}

function assertCoverageRetention(
  incoming: CoverageSnapshot,
  existing: CoverageSnapshot,
  minRetention: number
) {
  if (existing.laneCount <= 0) return;
  const laneRetention = incoming.laneCount / existing.laneCount;
  if (laneRetention < minRetention) {
    throw new Error(
      [
        'Freight import guardrail triggered: incoming lane coverage dropped too far.',
        `incoming_lanes=${incoming.laneCount}`,
        `existing_lanes=${existing.laneCount}`,
        `retention=${laneRetention.toFixed(3)}`,
        `min_retention=${minRetention.toFixed(3)}`,
      ].join(' ')
    );
  }

  if (existing.destinationCount <= 0) return;
  const destinationRetention = incoming.destinationCount / existing.destinationCount;
  if (destinationRetention < minRetention) {
    throw new Error(
      [
        'Freight import guardrail triggered: incoming destination coverage dropped too far.',
        `incoming_destinations=${incoming.destinationCount}`,
        `existing_destinations=${existing.destinationCount}`,
        `retention=${destinationRetention.toFixed(3)}`,
        `min_retention=${minRetention.toFixed(3)}`,
      ].join(' ')
    );
  }
}

export async function importFreightCards(cards: FreightCardImport[], opts: ImportOpts = {}) {
  const parsed = FreightCardsImportSchema.parse(cards);
  const items = parsed.map((card) => ({
    ...card,
    // Canonicalize lane codes to ISO3 so quote lookups are deterministic.
    origin: requireFreightIso3(card.origin, 'origin'),
    dest: requireFreightIso3(card.dest, 'dest'),
    currency: (card.currency ?? 'USD').toUpperCase(),
  }));
  const incomingCoverage = summarizeCoverage(items);
  if (incomingCoverage.laneCount <= 0) {
    throw new Error('Freight import guardrail triggered: source produced 0 unique lanes');
  }

  if (opts.enforceCoverageGuardrails) {
    const minRetention = opts.minCoverageRetention ?? DEFAULT_MIN_COVERAGE_RETENTION;
    if (!Number.isFinite(minRetention) || minRetention <= 0 || minRetention > 1) {
      throw new Error(
        `Invalid freight import minCoverageRetention (${String(minRetention)}); expected (0, 1]`
      );
    }
    const existingCoverage = await currentCoverageSnapshot();
    assertCoverageRetention(incomingCoverage, existingCoverage, minRetention);
  }

  await db.transaction(async (tx) => {
    for (const card of items) {
      const inserted = await tx
        .insert(freightRateCardsTable)
        .values({
          origin: card.origin,
          dest: card.dest,
          freightMode: card.freightMode,
          freightUnit: card.freightUnit,
          currency: card.currency,
          effectiveFrom: card.effectiveFrom,
          effectiveTo: card.effectiveTo ?? undefined,
          notes: card.notes ?? undefined,
          minCharge: card.minCharge != null ? String(card.minCharge) : undefined,
          priceRounding: card.priceRounding != null ? String(card.priceRounding) : undefined,
          volumetricDivisor: card.volumetricDivisor ?? undefined,
        })
        .onConflictDoUpdate({
          target: [
            freightRateCardsTable.origin,
            freightRateCardsTable.dest,
            freightRateCardsTable.freightMode,
            freightRateCardsTable.freightUnit,
            freightRateCardsTable.effectiveFrom,
          ],
          set: {
            currency: card.currency,
            effectiveTo: card.effectiveTo ?? sql`NULL`,
            notes: card.notes ?? sql`NULL`,
            minCharge: card.minCharge != null ? String(card.minCharge) : sql`NULL`,
            priceRounding: card.priceRounding != null ? String(card.priceRounding) : sql`NULL`,
            volumetricDivisor: card.volumetricDivisor != null ? card.volumetricDivisor : sql`NULL`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: freightRateCardsTable.id });

      const cardId = inserted[0]?.id;
      if (!cardId) throw new Error('Failed to upsert freight rate card (no id)');

      await tx.delete(freightRateStepsTable).where(eq(freightRateStepsTable.cardId, cardId));

      for (const step of card.steps) {
        await tx
          .insert(freightRateStepsTable)
          .values({
            cardId,
            uptoQty: String(step.uptoQty),
            pricePerUnit: String(step.pricePerUnit),
          })
          .onConflictDoUpdate({
            target: [freightRateStepsTable.cardId, freightRateStepsTable.uptoQty],
            set: { pricePerUnit: String(step.pricePerUnit), updatedAt: new Date() },
          });
      }

      if (opts.importId) {
        const canonical = {
          origin: card.origin,
          dest: card.dest,
          freightMode: card.freightMode,
          freightUnit: card.freightUnit,
          currency: card.currency,
          effectiveFrom: ymd(card.effectiveFrom),
          effectiveTo: ymd(card.effectiveTo ?? null),
          minCharge: card.minCharge ?? null,
          priceRounding: card.priceRounding ?? null,
          volumetricDivisor: card.volumetricDivisor ?? null,
          notes: card.notes ?? null,
          steps: card.steps.map((s) => ({ uptoQty: s.uptoQty, pricePerUnit: s.pricePerUnit })),
        };

        await tx.insert(provenanceTable).values({
          importId: opts.importId,
          resourceType: 'freight_card',
          resourceId: cardId,
          sourceRef: opts.makeSourceRef?.(card),
          rowHash: sha256Hex(JSON.stringify(canonical)),
        });
      }
    }
  });

  return { ok: true as const, count: items.length };
}
