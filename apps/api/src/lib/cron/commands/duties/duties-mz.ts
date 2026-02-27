import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mz',
  dest: 'MZ',
  mfnSourceKey: 'duties.mz.official.mfn_excel',
  ftaSourceKey: 'duties.mz.official.fta_excel',
  mfnEnvVar: 'MZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMzMfnOfficial = commands.mfn;
export const dutiesMzFtaOfficial = commands.fta;
export const dutiesMzAllOfficial = commands.all;
