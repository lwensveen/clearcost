import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'xk',
  dest: 'XK',
  mfnSourceKey: 'duties.xk.official.mfn_excel',
  ftaSourceKey: 'duties.xk.official.fta_excel',
  mfnEnvVar: 'XK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'XK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesXkMfnOfficial = commands.mfn;
export const dutiesXkFtaOfficial = commands.fta;
export const dutiesXkAllOfficial = commands.all;
