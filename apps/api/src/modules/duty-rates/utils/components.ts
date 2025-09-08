import { db, dutyRateComponentsTable, dutyRatesTable, provenanceTable } from '@clearcost/db';
import { and, inArray, sql } from 'drizzle-orm';
import { sha256Hex } from '../../../lib/provenance.js';
import { DutyRateComponentInsert, DutyRateComponentInsertSchema } from '@clearcost/types';
import {
  clamp,
  DEBUG,
  hasAmountFields,
  hasCurrency,
  hasFormula,
  hasQualifier,
  hasUom,
  isAdValorem,
  isoOrNull,
} from './utils.js';

export type ParentKey = {
  dest: string;
  partner: string;
  hs6: string;
  dutyRule: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard';
  effectiveFrom: Date | null | undefined;
};

export type DutyComponentInput =
  | {
      type: 'advalorem';
      ratePct: number;
      notes?: string;
      effectiveFrom?: Date | null;
      effectiveTo?: Date | null;
      formula?: unknown;
    }
  | {
      type: 'specific';
      amount: number;
      currency: string;
      uom: string;
      qualifier?: string;
      notes?: string;
      effectiveFrom?: Date | null;
      effectiveTo?: Date | null;
      formula?: unknown;
    }
  | {
      type: 'minimum' | 'maximum';
      amount: number;
      currency: string;
      uom: string;
      qualifier?: string;
      notes?: string;
      effectiveFrom?: Date | null;
      effectiveTo?: Date | null;
      formula?: unknown;
    }
  | {
      type: 'other';
      notes?: string;
      effectiveFrom?: Date | null;
      effectiveTo?: Date | null;
      formula?: unknown;
    };

export async function lookupDutyRateIds(keys: ParentKey[]) {
  if (!keys.length) return new Map<string, string>();

  const rows = await db
    .select({
      id: dutyRatesTable.id,
      dest: dutyRatesTable.dest,
      partner: dutyRatesTable.partner,
      hs6: dutyRatesTable.hs6,
      dutyRule: dutyRatesTable.dutyRule,
      effectiveFrom: dutyRatesTable.effectiveFrom,
    })
    .from(dutyRatesTable)
    .where(
      and(
        inArray(
          dutyRatesTable.dest,
          keys.map((key) => key.dest)
        ),
        inArray(
          dutyRatesTable.partner,
          keys.map((key) => key.partner ?? '')
        ),
        inArray(
          dutyRatesTable.hs6,
          keys.map((key) => key.hs6)
        ),
        inArray(
          dutyRatesTable.dutyRule,
          keys.map((key) => key.dutyRule)
        )
      )
    );

  const keyOf = (key: ParentKey) =>
    `${key.dest}::${key.partner ?? ''}::${key.hs6}::${key.dutyRule}::${
      key.effectiveFrom ? new Date(key.effectiveFrom).toISOString() : 'null'
    }`;

  const out = new Map<string, string>();
  for (const row of rows) {
    const mapKey = keyOf({
      dest: row.dest,
      partner: row.partner ?? '',
      hs6: row.hs6,
      dutyRule: row.dutyRule as ParentKey['dutyRule'],
      effectiveFrom: row.effectiveFrom ?? null,
    });
    out.set(mapKey, row.id);
  }
  return out;
}

export async function upsertComponentsForParents(params: {
  parents: ParentKey[];
  componentsByKey: Map<string, DutyComponentInput[]>;
  importId?: string;
  makeSourceRef?: (ctx: { parent: ParentKey; component: DutyComponentInput }) => string | undefined;
  validate?: boolean;
}) {
  if (!params.parents.length) return { inserted: 0, updated: 0, count: 0 };

  const keyOf = (key: ParentKey) =>
    `${key.dest}::${key.partner ?? ''}::${key.hs6}::${key.dutyRule}::${
      key.effectiveFrom ? new Date(key.effectiveFrom).toISOString() : 'null'
    }`;

  const parentByMapKey = new Map<string, ParentKey>();
  for (const parent of params.parents) parentByMapKey.set(keyOf(parent), parent);

  const idMap = await lookupDutyRateIds(params.parents);

  const parentById = new Map<string, ParentKey>();
  for (const [mapKey, parentId] of idMap.entries()) {
    const parent = parentByMapKey.get(mapKey);
    if (parent) parentById.set(parentId, parent);
  }

  const values: DutyRateComponentInsert[] = [];

  for (const parent of params.parents) {
    const mapKey = keyOf(parent);
    const dutyRateId = idMap.get(mapKey);
    if (!dutyRateId) continue;

    const items = params.componentsByKey.get(mapKey) ?? [];
    for (const component of items) {
      const base: Omit<DutyRateComponentInsert, 'id'> = {
        dutyRateId,
        componentType: component.type,
        ratePct: isAdValorem(component)
          ? component.ratePct != null
            ? String(component.ratePct)
            : null
          : null,
        amount: hasAmountFields(component)
          ? component.amount != null
            ? String(component.amount)
            : null
          : null,
        currency: hasCurrency(component) ? (component.currency ?? null) : null,
        uom: hasUom(component) ? (component.uom ?? null) : null,
        qualifier: hasQualifier(component) ? (component.qualifier ?? null) : null,
        formula: hasFormula(component) ? (component.formula ?? null) : null,
        notes: component.notes ?? null,
        effectiveFrom: component.effectiveFrom ?? null,
        effectiveTo: component.effectiveTo ?? null,
      };

      if (params.validate ?? DEBUG) {
        const parsed = DutyRateComponentInsertSchema.safeParse(base);
        if (!parsed.success) {
          console.warn(
            '[Components] insert schema validation failed:',
            parsed.error.issues,
            'for value:',
            base
          );
          continue;
        }
      }

      values.push(base as DutyRateComponentInsert);
    }
  }

  if (!values.length) return { inserted: 0, updated: 0, count: 0 };

  const returned = await db
    .insert(dutyRateComponentsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        dutyRateComponentsTable.dutyRateId,
        dutyRateComponentsTable.componentType,
        dutyRateComponentsTable.ratePct,
        dutyRateComponentsTable.amount,
        dutyRateComponentsTable.currency,
        dutyRateComponentsTable.uom,
        dutyRateComponentsTable.qualifier,
        dutyRateComponentsTable.effectiveFrom,
      ],
      set: {
        notes: sql`EXCLUDED.notes`,
        effectiveTo: sql`EXCLUDED.effective_to`,
        // keep formula up to date
        formula: sql`EXCLUDED.formula`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`
        ${dutyRateComponentsTable.notes} IS DISTINCT FROM EXCLUDED.notes
        OR ${dutyRateComponentsTable.effectiveTo} IS DISTINCT FROM EXCLUDED.effective_to
        OR ${dutyRateComponentsTable.formula} IS DISTINCT FROM EXCLUDED.formula
      `,
    })
    .returning({
      id: dutyRateComponentsTable.id,
      dutyRateId: dutyRateComponentsTable.dutyRateId,
      componentType: dutyRateComponentsTable.componentType,
      ratePct: dutyRateComponentsTable.ratePct,
      amount: dutyRateComponentsTable.amount,
      currency: dutyRateComponentsTable.currency,
      uom: dutyRateComponentsTable.uom,
      qualifier: dutyRateComponentsTable.qualifier,
      notes: dutyRateComponentsTable.notes,
      effectiveFrom: dutyRateComponentsTable.effectiveFrom,
      effectiveTo: dutyRateComponentsTable.effectiveTo,
      formula: dutyRateComponentsTable.formula,
      inserted: sql<number>`(xmax = 0)::int`,
    });

  const inserted = returned.reduce((sum, row) => sum + (row.inserted === 1 ? 1 : 0), 0);
  const updated = returned.length - inserted;

  if (params.importId && returned.length) {
    const provenanceRows = returned.map((row) => {
      const parent = parentById.get(row.dutyRateId);

      const normalizedForHash = {
        dutyRateId: row.dutyRateId,
        type: row.componentType,
        ratePct: row.ratePct ?? null,
        amount: row.amount ?? null,
        currency: row.currency ?? null,
        uom: row.uom ?? null,
        qualifier: row.qualifier ?? null,
        notes: row.notes ?? null,
        effectiveFrom: isoOrNull(row.effectiveFrom),
        effectiveTo: isoOrNull(row.effectiveTo),
        formula: row.formula ?? null,
      };
      const rowHash = sha256Hex(JSON.stringify(normalizedForHash));

      const defaultRef = parent
        ? `${parent.dest.toLowerCase()}:${parent.dutyRule}:${parent.partner || 'mfn'}:${parent.hs6}:${row.componentType}`
        : `component:${row.componentType}:${row.dutyRateId}`;

      const sourceRef =
        (params.makeSourceRef
          ? params.makeSourceRef({
              parent:
                parent ??
                ({
                  dest: '??',
                  partner: '',
                  hs6: '??????',
                  dutyRule: 'mfn',
                  effectiveFrom: null,
                } as ParentKey),
              component:
                row.componentType === 'advalorem'
                  ? { type: 'advalorem', ratePct: Number(row.ratePct ?? 0) }
                  : row.amount != null
                    ? row.componentType === 'specific'
                      ? {
                          type: 'specific',
                          amount: Number(row.amount),
                          currency: String(row.currency ?? ''),
                          uom: String(row.uom ?? ''),
                        }
                      : {
                          type: row.componentType as 'minimum' | 'maximum',
                          amount: Number(row.amount),
                          currency: String(row.currency ?? ''),
                          uom: String(row.uom ?? ''),
                        }
                    : { type: 'other' },
            })
          : defaultRef) ?? defaultRef;

      return {
        importId: params.importId!,
        resourceType: 'duty_rate_component' as const,
        resourceId: row.id,
        sourceRef: clamp(sourceRef, 255),
        sourceHash: null,
        rowHash,
      };
    });

    try {
      await db.insert(provenanceTable).values(provenanceRows);
    } catch (error) {
      console.warn('[Components] provenance insert failed:', (error as Error).message);
    }
  }

  return { inserted, updated, count: returned.length };
}
