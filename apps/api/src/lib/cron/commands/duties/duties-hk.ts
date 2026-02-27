import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'hk',
  dest: 'HK',
  mfnSourceKey: 'duties.hk.official.mfn_excel',
  ftaSourceKey: 'duties.hk.official.fta_excel',
  mfnEnvVar: 'HK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHkMfnOfficial = commands.mfn;
export const dutiesHkFtaOfficial = commands.fta;
export const dutiesHkAllOfficial = commands.all;
