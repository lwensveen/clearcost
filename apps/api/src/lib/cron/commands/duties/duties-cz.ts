import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cz',
  dest: 'CZ',
  mfnSourceKey: 'duties.cz.official.mfn_excel',
  ftaSourceKey: 'duties.cz.official.fta_excel',
  mfnEnvVar: 'CZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCzMfnOfficial = commands.mfn;
export const dutiesCzFtaOfficial = commands.fta;
export const dutiesCzAllOfficial = commands.all;
