import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { importFreightCards } from '../../../modules/freight/services/import-cards.js';
import { fetchJSON } from '../utils.js';
import { FreightCardsImportSchema } from '@clearcost/types';

export const freightJson: Command = async (args) => {
  const url = args[0];
  if (!url) throw new Error('Pass URL to JSON (freight cards)');

  const payload = await withRun(
    { importSource: 'FILE', job: 'freight:json', sourceKey: 'freight.cards.json', params: { url } },
    async () => {
      const raw: unknown = await fetchJSON(url);
      const rows = FreightCardsImportSchema.parse(raw);
      const res = await importFreightCards(rows, { enforceCoverageGuardrails: true });
      const inserted = Number(res?.count ?? 0);

      return { inserted, payload: res };
    }
  );
  console.log(payload);
};
