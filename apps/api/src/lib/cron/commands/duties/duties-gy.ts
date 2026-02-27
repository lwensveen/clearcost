import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gy',
  dest: 'GY',
  mfnSourceKey: 'duties.gy.official.mfn_excel',
  ftaSourceKey: 'duties.gy.official.fta_excel',
  mfnEnvVar: 'GY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGyMfnOfficial = commands.mfn;
export const dutiesGyFtaOfficial = commands.fta;
export const dutiesGyAllOfficial = commands.all;
