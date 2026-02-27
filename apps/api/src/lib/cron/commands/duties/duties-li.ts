import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'li',
  dest: 'LI',
  mfnSourceKey: 'duties.li.official.mfn_excel',
  ftaSourceKey: 'duties.li.official.fta_excel',
  mfnEnvVar: 'LI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLiMfnOfficial = commands.mfn;
export const dutiesLiFtaOfficial = commands.fta;
export const dutiesLiAllOfficial = commands.all;
