import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lk',
  dest: 'LK',
  mfnSourceKey: 'duties.lk.official.mfn_excel',
  ftaSourceKey: 'duties.lk.official.fta_excel',
  mfnEnvVar: 'LK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLkMfnOfficial = commands.mfn;
export const dutiesLkFtaOfficial = commands.fta;
export const dutiesLkAllOfficial = commands.all;
