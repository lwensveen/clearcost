import type { Command } from '../runtime.js';
import { ensureDate, fetchJSON, toDateOrNull, toNumeric3String, withRun } from '../runtime.js';
import { importDutyRates } from '../../../modules/duty-rates/services/import-duty-rates.js';

type DutyRateWire = {
  dest: string;
  hs6: string;
  ratePct: number | string;
  partner?: string | null;
  rule?: 'mfn' | 'fta' | 'anti_dumping' | 'safeguard';
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export const dutiesJson: Command = async (args) => {
  const url = args[0];
  if (!url) throw new Error('Pass URL to JSON (duty rates)');

  const payload = await withRun<any>(
    { importSource: 'FILE', job: 'duties:json', params: { url } },
    async () => {
      const wire = await fetchJSON<DutyRateWire[]>(url);
      const normalized = wire.map((r) => ({
        dest: String(r.dest).toUpperCase(),
        partner: r.partner ?? null,
        hs6: String(r.hs6).slice(0, 6),
        ratePct: typeof r.ratePct === 'string' ? r.ratePct : toNumeric3String(r.ratePct),
        rule: r.rule,
        currency: r.currency ?? undefined,
        effectiveFrom: ensureDate(r.effectiveFrom, 'effectiveFrom'),
        effectiveTo: toDateOrNull(r.effectiveTo) ?? null,
        notes: r.notes ?? undefined,
      }));
      const res = await importDutyRates(normalized);
      const inserted = res?.count ?? normalized.length ?? 0;

      return { inserted, payload: res };
    }
  );

  console.log(payload);
};
