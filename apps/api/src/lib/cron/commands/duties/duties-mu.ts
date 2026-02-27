import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mu',
  dest: 'MU',
  mfnSourceKey: 'duties.mu.official.mfn_excel',
  ftaSourceKey: 'duties.mu.official.fta_excel',
  mfnEnvVar: 'MU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMuMfnOfficial = commands.mfn;
export const dutiesMuFtaOfficial = commands.fta;
export const dutiesMuAllOfficial = commands.all;
