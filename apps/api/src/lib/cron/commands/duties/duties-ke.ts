import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ke',
  dest: 'KE',
  mfnSourceKey: 'duties.ke.official.mfn_excel',
  ftaSourceKey: 'duties.ke.official.fta_excel',
  mfnEnvVar: 'KE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKeMfnOfficial = commands.mfn;
export const dutiesKeFtaOfficial = commands.fta;
export const dutiesKeAllOfficial = commands.all;
