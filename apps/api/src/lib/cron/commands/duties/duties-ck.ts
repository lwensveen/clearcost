import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ck',
  dest: 'CK',
  mfnSourceKey: 'duties.ck.official.mfn_excel',
  ftaSourceKey: 'duties.ck.official.fta_excel',
  mfnEnvVar: 'CK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCkMfnOfficial = commands.mfn;
export const dutiesCkFtaOfficial = commands.fta;
export const dutiesCkAllOfficial = commands.all;
