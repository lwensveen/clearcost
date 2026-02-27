import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ly',
  dest: 'LY',
  mfnSourceKey: 'duties.ly.official.mfn_excel',
  ftaSourceKey: 'duties.ly.official.fta_excel',
  mfnEnvVar: 'LY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLyMfnOfficial = commands.mfn;
export const dutiesLyFtaOfficial = commands.fta;
export const dutiesLyAllOfficial = commands.all;
