import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sy',
  dest: 'SY',
  mfnSourceKey: 'duties.sy.official.mfn_excel',
  ftaSourceKey: 'duties.sy.official.fta_excel',
  mfnEnvVar: 'SY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSyMfnOfficial = commands.mfn;
export const dutiesSyFtaOfficial = commands.fta;
export const dutiesSyAllOfficial = commands.all;
