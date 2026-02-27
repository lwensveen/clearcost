import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'in',
  dest: 'IN',
  mfnSourceKey: 'duties.in.official.mfn_excel',
  ftaSourceKey: 'duties.in.official.fta_excel',
  mfnEnvVar: 'IN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesInMfnOfficial = commands.mfn;
export const dutiesInFtaOfficial = commands.fta;
export const dutiesInAllOfficial = commands.all;
