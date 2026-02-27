import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pw',
  dest: 'PW',
  mfnSourceKey: 'duties.pw.official.mfn_excel',
  ftaSourceKey: 'duties.pw.official.fta_excel',
  mfnEnvVar: 'PW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPwMfnOfficial = commands.mfn;
export const dutiesPwFtaOfficial = commands.fta;
export const dutiesPwAllOfficial = commands.all;
