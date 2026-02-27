import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fj',
  dest: 'FJ',
  mfnSourceKey: 'duties.fj.official.mfn_excel',
  ftaSourceKey: 'duties.fj.official.fta_excel',
  mfnEnvVar: 'FJ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FJ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFjMfnOfficial = commands.mfn;
export const dutiesFjFtaOfficial = commands.fta;
export const dutiesFjAllOfficial = commands.all;
