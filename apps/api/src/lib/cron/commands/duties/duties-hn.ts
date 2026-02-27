import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'hn',
  dest: 'HN',
  mfnSourceKey: 'duties.hn.official.mfn_excel',
  ftaSourceKey: 'duties.hn.official.fta_excel',
  mfnEnvVar: 'HN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHnMfnOfficial = commands.mfn;
export const dutiesHnFtaOfficial = commands.fta;
export const dutiesHnAllOfficial = commands.all;
