// apps/api/src/lib/cron/commands/surcharges-json.ts
import type { Command } from '../runtime.js';
import { ensureDate, fetchJSON, toDateOrNull, withRun } from '../runtime.js';
import { batchUpsertSurchargesFromStream } from '../../../modules/surcharges/utils/batch-upsert.js';

type SurchargeWire = {
  dest: string;
  code: string;
  fixedAmt?: string;
  pctAmt?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export const surchargesJson: Command = async (args) => {
  const url = args[0];
  if (!url) throw new Error('Pass URL to JSON (surcharges)');

  const payload = await withRun<any>(
    { source: 'file', job: 'surcharges:json', params: { url } },
    async (importId) => {
      const wire = await fetchJSON<SurchargeWire[]>(url);
      const mapped = wire.map((r) => ({
        dest: String(r.dest).toUpperCase(),
        code: r.code,
        fixedAmt: r.fixedAmt,
        pctAmt: r.pctAmt,
        effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
        effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
        notes: r.notes ?? undefined,
      }));

      const res = await batchUpsertSurchargesFromStream(mapped as any, {
        importId,
        makeSourceRef: () => `file:${url}`,
        batchSize: 5000,
      });
      const inserted = Number((res as any)?.inserted ?? (res as any)?.count ?? 0);
      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
