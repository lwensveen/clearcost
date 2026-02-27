import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ps',
  dest: 'PS',
  mfnSourceKey: 'duties.ps.official.mfn_excel',
  ftaSourceKey: 'duties.ps.official.fta_excel',
  mfnEnvVar: 'PS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPsMfnOfficial = commands.mfn;
export const dutiesPsFtaOfficial = commands.fta;
export const dutiesPsAllOfficial = commands.all;
