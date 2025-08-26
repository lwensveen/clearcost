import type { Command } from '../runtime.js';
import { fetchJSON, withRun } from '../runtime.js';
import { importFreightCards } from '../../../modules/freight/services/import-cards.js';

export const freightJson: Command = async (args) => {
  const url = args[0];
  if (!url) throw new Error('Pass URL to JSON (freight cards)');

  const payload = await withRun(
    { source: 'file', job: 'freight:json', params: { url } },
    async () => {
      const rows: any = await fetchJSON(url);
      const res = await importFreightCards(rows);
      const inserted = Number(res?.count ?? 0);

      return { inserted, payload: res };
    }
  );
  console.log(payload);
};
