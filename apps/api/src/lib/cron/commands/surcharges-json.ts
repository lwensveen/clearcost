import type { Command } from '../runtime.js';
import { ensureDate, fetchJSON, toDateOrNull, withRun } from '../runtime.js';
import { batchUpsertSurchargesFromStream } from '../../../modules/surcharges/utils/batch-upsert.js';

type SurchargeWire = {
  dest: string;
  surchargeCode:
    | 'ANTIDUMPING'
    | 'COUNTERVAILING'
    | 'CUSTOMS_PROCESSING'
    | 'DISBURSEMENT'
    | 'EXCISE'
    | 'FUEL'
    | 'HANDLING'
    | 'HMF'
    | 'MPF'
    | 'OTHER'
    | 'REMOTE'
    | 'SECURITY'
    | 'TRADE_REMEDY_232'
    | 'TRADE_REMEDY_301';
  fixedAmt?: string;
  pctAmt?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export const surchargesJson: Command = async (args) => {
  const url = args[0];
  if (!url) throw new Error('Pass URL to JSON (surcharges)');

  const payload = await withRun(
    { importSource: 'FILE', job: 'surcharges:json', params: { url } },
    async (importId) => {
      const wire = await fetchJSON<SurchargeWire[]>(url);
      const mapped = wire.map((r) => ({
        dest: String(r.dest).toUpperCase(),
        surchargeCode: r.surchargeCode,
        fixedAmt: r.fixedAmt,
        pctAmt: r.pctAmt,
        effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
        effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
        notes: r.notes ?? undefined,
      }));

      const res = await batchUpsertSurchargesFromStream(mapped, {
        importId,
        makeSourceRef: () => `file:${url}`,
        batchSize: 5000,
      });
      const inserted = res?.count ?? res?.count ?? 0;
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
