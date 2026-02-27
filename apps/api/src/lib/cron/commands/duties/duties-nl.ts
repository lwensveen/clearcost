import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nl',
  dest: 'NL',
  mfnSourceKey: 'duties.nl.official.mfn_excel',
  ftaSourceKey: 'duties.nl.official.fta_excel',
  mfnEnvVar: 'NL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNlMfnOfficial = commands.mfn;
export const dutiesNlFtaOfficial = commands.fta;
export const dutiesNlAllOfficial = commands.all;
