// Thin adapter to your existing WITS MFN importer
import { importMfnFromWits } from '../wits/import-mfn.js';

export async function importCnMfn(params: {
  hs6List?: string[];
  batchSize?: number;
  importId?: string;
  dryRun?: boolean;
}) {
  return importMfnFromWits({
    dest: 'CN',
    hs6List: params.hs6List,
    batchSize: params.batchSize,
    importId: params.importId,
    dryRun: params.dryRun,
  });
}
