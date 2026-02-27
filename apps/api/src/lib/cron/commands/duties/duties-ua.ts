import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ua',
  dest: 'UA',
  mfnSourceKey: 'duties.ua.official.mfn_excel',
  ftaSourceKey: 'duties.ua.official.fta_excel',
  mfnEnvVar: 'UA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'UA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesUaMfnOfficial = commands.mfn;
export const dutiesUaFtaOfficial = commands.fta;
export const dutiesUaAllOfficial = commands.all;
