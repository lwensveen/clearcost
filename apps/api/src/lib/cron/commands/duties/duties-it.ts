import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'it',
  dest: 'IT',
  mfnSourceKey: 'duties.it.official.mfn_excel',
  ftaSourceKey: 'duties.it.official.fta_excel',
  mfnEnvVar: 'IT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesItMfnOfficial = commands.mfn;
export const dutiesItFtaOfficial = commands.fta;
export const dutiesItAllOfficial = commands.all;
