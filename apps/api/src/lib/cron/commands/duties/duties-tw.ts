import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tw',
  dest: 'TW',
  mfnSourceKey: 'duties.tw.official.mfn_excel',
  ftaSourceKey: 'duties.tw.official.fta_excel',
  mfnEnvVar: 'TW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTwMfnOfficial = commands.mfn;
export const dutiesTwFtaOfficial = commands.fta;
export const dutiesTwAllOfficial = commands.all;
