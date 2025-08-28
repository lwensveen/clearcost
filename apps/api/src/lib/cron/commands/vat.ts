import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { fetchVatRowsFromOfficialSources } from '../../../modules/vat/services/fetch-vat-official.js';
import { importVatRules } from '../../../modules/vat/services/import-vat.js';

export const vatAuto: Command = async () => {
  const payload = await withRun({ importSource: 'OECD/IMF', job: 'vat:auto' }, async () => {
    const rows = await fetchVatRowsFromOfficialSources();
    const res = await importVatRules(rows);
    const inserted = res?.count ?? rows.length ?? 0;

    return { inserted, payload: res };
  });
  console.log(payload);
};
