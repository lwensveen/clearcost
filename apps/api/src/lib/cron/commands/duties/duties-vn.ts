import type { Command } from '../../runtime.js';
import { withRun } from '../../runtime.js';
import { importVnMfn } from '../../../../modules/duty-rates/services/asean/vn/import-mfn.js';
import { importVnPreferential } from '../../../../modules/duty-rates/services/asean/vn/import-preferential.js';

export const dutiesVnMfn: Command = async () => {
  const payload = await withRun(
    { importSource: 'WITS', job: 'duties:vn-mfn' },
    async (importId) => {
      const res = await importVnMfn({ importId });
      return { inserted: res.inserted, payload: res };
    }
  );
  console.log(payload);
};

export const dutiesVnFta: Command = async () => {
  const payload = await withRun(
    { importSource: 'WITS', job: 'duties:vn-fta' },
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
