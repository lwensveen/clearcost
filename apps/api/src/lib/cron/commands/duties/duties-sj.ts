import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sj',
  dest: 'SJ',
  mfnSourceKey: 'duties.sj.official.mfn_excel',
  ftaSourceKey: 'duties.sj.official.fta_excel',
  mfnEnvVar: 'SJ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SJ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSjMfnOfficial = commands.mfn;
export const dutiesSjFtaOfficial = commands.fta;
export const dutiesSjAllOfficial = commands.all;
