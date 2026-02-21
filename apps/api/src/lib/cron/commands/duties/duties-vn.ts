import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { importVnMfn } from '../../../../modules/duty-rates/services/asean/vn/import-mfn.js';
import { importVnPreferential } from '../../../../modules/duty-rates/services/asean/vn/import-preferential.js';
import { assertWitsImportsEnabled } from '../../../wits-gate.js';

export const dutiesVnMfn: Command = async () => {
  assertWitsImportsEnabled();
  const payload = await withRun(
    { importSource: 'WITS', job: 'duties:vn-mfn', params: { sourceKey: 'duties.wits.sdmx.base' } },
    async (importId) => {
      const res = await importVnMfn({ importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesVnFta: Command = async () => {
  assertWitsImportsEnabled();
  const payload = await withRun(
    { importSource: 'WITS', job: 'duties:vn-fta', params: { sourceKey: 'duties.wits.sdmx.base' } },
    async (importId) => {
      const res = await importVnPreferential({
        importId,
        // add a default partner list if you want
        partnerGeoIds: ['ASEAN', 'JP', 'KR', 'CN', 'AU', 'NZ', 'EU', 'GB', 'IN', 'HK', 'EAEU'],
      });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};
