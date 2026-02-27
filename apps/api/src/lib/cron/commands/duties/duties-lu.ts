import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lu',
  dest: 'LU',
  mfnSourceKey: 'duties.lu.official.mfn_excel',
  ftaSourceKey: 'duties.lu.official.fta_excel',
  mfnEnvVar: 'LU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLuMfnOfficial = commands.mfn;
export const dutiesLuFtaOfficial = commands.fta;
export const dutiesLuAllOfficial = commands.all;
