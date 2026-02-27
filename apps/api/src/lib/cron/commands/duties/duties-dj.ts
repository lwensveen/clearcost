import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'dj',
  dest: 'DJ',
  mfnSourceKey: 'duties.dj.official.mfn_excel',
  ftaSourceKey: 'duties.dj.official.fta_excel',
  mfnEnvVar: 'DJ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DJ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDjMfnOfficial = commands.mfn;
export const dutiesDjFtaOfficial = commands.fta;
export const dutiesDjAllOfficial = commands.all;
