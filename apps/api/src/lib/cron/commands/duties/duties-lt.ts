import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lt',
  dest: 'LT',
  mfnSourceKey: 'duties.lt.official.mfn_excel',
  ftaSourceKey: 'duties.lt.official.fta_excel',
  mfnEnvVar: 'LT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLtMfnOfficial = commands.mfn;
export const dutiesLtFtaOfficial = commands.fta;
export const dutiesLtAllOfficial = commands.all;
