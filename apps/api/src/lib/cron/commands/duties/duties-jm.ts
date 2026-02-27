import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'jm',
  dest: 'JM',
  mfnSourceKey: 'duties.jm.official.mfn_excel',
  ftaSourceKey: 'duties.jm.official.fta_excel',
  mfnEnvVar: 'JM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'JM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesJmMfnOfficial = commands.mfn;
export const dutiesJmFtaOfficial = commands.fta;
export const dutiesJmAllOfficial = commands.all;
