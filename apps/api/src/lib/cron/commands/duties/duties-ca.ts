import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ca',
  dest: 'CA',
  mfnSourceKey: 'duties.ca.official.mfn_excel',
  ftaSourceKey: 'duties.ca.official.fta_excel',
  mfnEnvVar: 'CA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCaMfnOfficial = commands.mfn;
export const dutiesCaFtaOfficial = commands.fta;
export const dutiesCaAllOfficial = commands.all;
