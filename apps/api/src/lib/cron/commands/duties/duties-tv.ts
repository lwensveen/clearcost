import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tv',
  dest: 'TV',
  mfnSourceKey: 'duties.tv.official.mfn_excel',
  ftaSourceKey: 'duties.tv.official.fta_excel',
  mfnEnvVar: 'TV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTvMfnOfficial = commands.mfn;
export const dutiesTvFtaOfficial = commands.fta;
export const dutiesTvAllOfficial = commands.all;
