import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'dz',
  dest: 'DZ',
  mfnSourceKey: 'duties.dz.official.mfn_excel',
  ftaSourceKey: 'duties.dz.official.fta_excel',
  mfnEnvVar: 'DZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDzMfnOfficial = commands.mfn;
export const dutiesDzFtaOfficial = commands.fta;
export const dutiesDzAllOfficial = commands.all;
