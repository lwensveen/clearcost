import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sa',
  dest: 'SA',
  mfnSourceKey: 'duties.sa.official.mfn_excel',
  ftaSourceKey: 'duties.sa.official.fta_excel',
  mfnEnvVar: 'SA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSaMfnOfficial = commands.mfn;
export const dutiesSaFtaOfficial = commands.fta;
export const dutiesSaAllOfficial = commands.all;
