import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tj',
  dest: 'TJ',
  mfnSourceKey: 'duties.tj.official.mfn_excel',
  ftaSourceKey: 'duties.tj.official.fta_excel',
  mfnEnvVar: 'TJ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TJ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTjMfnOfficial = commands.mfn;
export const dutiesTjFtaOfficial = commands.fta;
export const dutiesTjAllOfficial = commands.all;
