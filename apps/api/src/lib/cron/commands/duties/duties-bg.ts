import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bg',
  dest: 'BG',
  mfnSourceKey: 'duties.bg.official.mfn_excel',
  ftaSourceKey: 'duties.bg.official.fta_excel',
  mfnEnvVar: 'BG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBgMfnOfficial = commands.mfn;
export const dutiesBgFtaOfficial = commands.fta;
export const dutiesBgAllOfficial = commands.all;
