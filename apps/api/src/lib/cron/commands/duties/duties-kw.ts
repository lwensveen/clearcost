import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'kw',
  dest: 'KW',
  mfnSourceKey: 'duties.kw.official.mfn_excel',
  ftaSourceKey: 'duties.kw.official.fta_excel',
  mfnEnvVar: 'KW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKwMfnOfficial = commands.mfn;
export const dutiesKwFtaOfficial = commands.fta;
export const dutiesKwAllOfficial = commands.all;
