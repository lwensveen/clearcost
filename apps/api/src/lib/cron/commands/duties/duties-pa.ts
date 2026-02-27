import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pa',
  dest: 'PA',
  mfnSourceKey: 'duties.pa.official.mfn_excel',
  ftaSourceKey: 'duties.pa.official.fta_excel',
  mfnEnvVar: 'PA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPaMfnOfficial = commands.mfn;
export const dutiesPaFtaOfficial = commands.fta;
export const dutiesPaAllOfficial = commands.all;
