import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ga',
  dest: 'GA',
  mfnSourceKey: 'duties.ga.official.mfn_excel',
  ftaSourceKey: 'duties.ga.official.fta_excel',
  mfnEnvVar: 'GA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGaMfnOfficial = commands.mfn;
export const dutiesGaFtaOfficial = commands.fta;
export const dutiesGaAllOfficial = commands.all;
