import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bm',
  dest: 'BM',
  mfnSourceKey: 'duties.bm.official.mfn_excel',
  ftaSourceKey: 'duties.bm.official.fta_excel',
  mfnEnvVar: 'BM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBmMfnOfficial = commands.mfn;
export const dutiesBmFtaOfficial = commands.fta;
export const dutiesBmAllOfficial = commands.all;
