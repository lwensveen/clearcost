import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cw',
  dest: 'CW',
  mfnSourceKey: 'duties.cw.official.mfn_excel',
  ftaSourceKey: 'duties.cw.official.fta_excel',
  mfnEnvVar: 'CW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCwMfnOfficial = commands.mfn;
export const dutiesCwFtaOfficial = commands.fta;
export const dutiesCwAllOfficial = commands.all;
