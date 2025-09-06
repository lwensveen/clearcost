import { importPreferentialFromWits } from '../../wits/import-preferential.js';

export async function importSgPreferential(params: {
  hs6List?: string[];
  partnerGeoIds?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}) {
  return importPreferentialFromWits({
    dest: 'SG',
    hs6List: params.hs6List,
    partnerGeoIds: params.partnerGeoIds,
    batchSize: params.batchSize,
    importId: params.importId,
    dryRun: params.dryRun,
  });
}
