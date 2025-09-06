import { importMfnFromWits } from '../../wits/import-mfn.js';

export async function importVnMfn(params: {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}) {
  return importMfnFromWits({
    dest: 'VN',
    hs6List: params.hs6List,
    batchSize: params.batchSize,
    importId: params.importId,
    dryRun: params.dryRun,
  });
}
