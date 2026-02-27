import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bj',
  dest: 'BJ',
  mfnSourceKey: 'duties.bj.official.mfn_excel',
  ftaSourceKey: 'duties.bj.official.fta_excel',
  mfnEnvVar: 'BJ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BJ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBjMfnOfficial = commands.mfn;
export const dutiesBjFtaOfficial = commands.fta;
export const dutiesBjAllOfficial = commands.all;
